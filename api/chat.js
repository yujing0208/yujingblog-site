/**
 * Vercel Serverless Function — Cloudflare Workers AI 代理
 * 前端 POST /api/chat → 本函数 → Cloudflare Workers AI → 流式返回
 *
 * 免费优先设计：
 * - 模型固定为 Cloudflare Workers Free 可用的 GLM-4.7-Flash
 * - 关闭 reasoning，优先低延迟聊天，不把输出额度耗在思考过程上
 * - 不配置任何付费 fallback，额度用尽后直接返回 429
 * - API Token 只存在 Vercel 环境变量，不暴露给浏览器
 * - 控制上下文与输出长度，优先降低首字响应延迟和免费额度消耗
 *
 * 环境变量：
 * - CLOUDFLARE_ACCOUNT_ID
 * - CLOUDFLARE_API_TOKEN
 */

const MODEL = "@cf/zai-org/glm-4.7-flash";

// 看板娘属于短对话场景：减少无意义历史，降低输入处理时间与 Neurons 消耗。
const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 3000;
const MAX_TOTAL_CHARS = 12000;
const MAX_COMPLETION_TOKENS = 320;

function errorResponse(res, status, error, code) {
  const payload = JSON.stringify({
    error,
    ...(code ? { code } : {}),
  });

  // Vercel Node.js Serverless Function 使用 Node 的 ServerResponse，
  // 没有 Express 的 res.status().json() API。
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

module.exports = async function handler(req, res) {
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
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: normalizedMessages,
        stream: true,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        chat_template_kwargs: {
          enable_thinking: false,
        },
      }),
    });

    if (!response.ok) {
      const rawText = await response.text();
      let data;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { error: rawText || "Unknown Cloudflare AI response" };
      }

      // Free 额度耗尽时只停止 AI，不切换到任何付费 Provider。
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

    if (!response.body) {
      return errorResponse(res, 502, "AI stream unavailable", "AI_STREAM_UNAVAILABLE");
    }

    // 直接透传 Cloudflare SSE，避免等待完整答案再返回。
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const reader = response.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    res.end();
  } catch (err) {
    console.error("Chat proxy error:", err);

    if (err instanceof Error && err.message === "Invalid message role") {
      return errorResponse(res, 400, "Invalid message role", "INVALID_MESSAGE");
    }

    if (err instanceof Error && err.message === "Invalid message content length") {
      return errorResponse(res, 400, "Message is empty or too long", "MESSAGE_LENGTH");
    }

    // 如果响应已经开始流式输出，不能再发送 JSON 错误响应。
    if (res.headersSent) {
      try {
        res.write(`data: ${JSON.stringify({ error: "AI stream interrupted" })}\n\n`);
      } catch {}
      try {
        res.end();
      } catch {}
      return;
    }

    return errorResponse(res, 502, "AI proxy error", "PROXY_ERROR");
  }
};