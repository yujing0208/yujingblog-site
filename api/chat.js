/**
 * Vercel Serverless Function — Cloudflare Workers AI 代理
 * 前端 POST /api/chat → 本函数 → Cloudflare Workers AI → 返回
 *
 * 免费优先设计：
 * - 模型固定为 Cloudflare Workers Free 可用的 GLM-4.7-Flash
 * - 不配置任何付费 fallback，额度用尽后直接返回 429
 * - API Token 只存在 Vercel 环境变量，不暴露给浏览器
 *
 * 环境变量：
 * - CLOUDFLARE_ACCOUNT_ID
 * - CLOUDFLARE_API_TOKEN
 */

const MODEL = "@cf/zai-org/glm-4.7-flash";
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 24000;
const MAX_COMPLETION_TOKENS = 512;

function errorResponse(res, status, error, code) {
  return res.status(status).json({
    error,
    ...(code ? { code } : {}),
  });
}

export default async function handler(req, res) {
  // 仅允许 POST
  if (req.method !== "POST") {
    return errorResponse(res, 405, "Method not allowed", "METHOD_NOT_ALLOWED");
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return errorResponse(
      res,
      500,
      "Cloudflare AI is not configured",
      "AI_NOT_CONFIGURED"
    );
  }

  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse(res, 400, "messages array required", "INVALID_MESSAGES");
    }

    // 防止公开 API 被超长上下文滥用，也控制 Workers AI 免费额度消耗。
    if (messages.length > MAX_MESSAGES) {
      return errorResponse(res, 400, "Too many messages", "MESSAGE_LIMIT");
    }

    const normalizedMessages = messages.map((message) => {
      if (!message || !["system", "user", "assistant"].includes(message.role)) {
        throw new Error("Invalid message role");
      }

      const content = typeof message.content === "string" ? message.content : "";
      if (!content || content.length > MAX_MESSAGE_CHARS) {
        throw new Error("Invalid message content length");
      }

      return {
        role: message.role,
        content,
      };
    });

    const totalChars = normalizedMessages.reduce(
      (total, message) => total + message.content.length,
      0
    );

    if (totalChars > MAX_TOTAL_CHARS) {
      return errorResponse(res, 400, "Conversation is too long", "CONTEXT_LIMIT");
    }

    const endpoint =
      `https://api.cloudflare.com/client/v4/accounts/${accountId}` +
      `/ai/v1/chat/completions`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: normalizedMessages,
        stream: false,
        max_tokens: MAX_COMPLETION_TOKENS,
      }),
    });

    const rawText = await response.text();
    let data;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { error: rawText || "Unknown Cloudflare AI response" };
    }

    if (!response.ok) {
      // Cloudflare 429 / 3036 = 每日 10,000 Neurons 免费额度已用尽。
      // 这里绝不 fallback 到任何付费模型，确保博客不会因为聊天产生意外费用。
      if (response.status === 429) {
        return errorResponse(
          res,
          429,
          "今天的免费 AI 聊天额度已经用完啦，明天再来找诺瓦吧~ 🐾",
          "FREE_QUOTA_EXCEEDED"
        );
      }

      if (response.status === 403) {
        return errorResponse(
          res,
          503,
          "AI 服务当前不可用，请稍后再试~",
          "AI_ACCESS_DENIED"
        );
      }

      console.error("Cloudflare AI API error:", response.status, data);
      return errorResponse(res, 502, "AI service error", "AI_PROVIDER_ERROR");
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Chat proxy error:", err);

    if (err instanceof Error && err.message === "Invalid message role") {
      return errorResponse(res, 400, "Invalid message role", "INVALID_MESSAGE");
    }

    if (err instanceof Error && err.message === "Invalid message content length") {
      return errorResponse(res, 400, "Message is empty or too long", "MESSAGE_LENGTH");
    }

    return errorResponse(res, 502, "AI proxy error", "PROXY_ERROR");
  }
}
