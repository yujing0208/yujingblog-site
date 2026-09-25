/**
 * Vercel Serverless Function — GitHub 仓库卡片数据代理
 *
 * 背景：文章的 ::github{repo="owner/repo"} 指令由 src/plugins/remark-github-card.mjs
 * 编译成一段「骨架卡片」静态 HTML（a.card-github.fetch-waiting），
 * 骨架状态靠前端 JS 摘掉，但原实现里没有任何脚本去摘 —— 于是永远转圈。
 *
 * 这个接口把「浏览器直连 api.github.com」换成本站服务端代理，原因有三：
 * 1. 中国大陆直连 api.github.com 经常不通/被重置，卡片就一直卡在骨架；
 * 2. 匿名调用 api.github.com 只有 60 次/小时/IP，Vercel 出口 IP 是共享的，很容易 403；
 * 3. 服务端可以带 token（5000 次/小时），并配合 CDN 缓存，基本不会打到 GitHub。
 *
 * 调用形态：GET /api/github-card?repo=owner/name
 *
 * 安全边界：
 * - 只有 owner 在白名单里的仓库才允许查询（默认 yujing0208、ClassIntra，
 *   可用环境变量 GH_CARD_OWNERS 追加，逗号分隔）；
 * - 私有仓库一律拒绝并返回 404，避免拿这个接口当「探测私有仓库」的探针；
 * - 只回传卡片需要的字段，不原样透传 GitHub 的响应。
 *
 * 环境变量：GH_TOKEN（可选。配了就带 token 调用，没配则匿名，仍可用）
 *
 * 注意：本文件必须使用 CommonJS（module.exports），原因见 api/chat.js 顶部注释。
 */

const DEFAULT_OWNERS = ["yujing0208", "ClassIntra"];
const GH_API = "https://api.github.com";
const CACHE_TTL_MS = 10 * 60 * 1000; // 进程内缓存 10 分钟
const UPSTREAM_TIMEOUT_MS = 8000;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/;

/** 进程内缓存（Serverless 多实例下各自一份，仅是省流，真正扛量的是下面的 CDN 缓存头） */
const cache = new Map();

function allowedOwners() {
  const extra = String(process.env.GH_CARD_OWNERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const all = DEFAULT_OWNERS.concat(extra);
  return all.map((s) => s.toLowerCase());
}

function json(res, status, payload, maxAge) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (maxAge && status === 200) {
    // 浏览器不缓存（前端另有 sessionStorage），Vercel 边缘缓存 30 分钟、
    // 之后 24 小时内可先用旧值兜底再后台刷新 —— 极大降低打到 GitHub 的次数。
    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=" + maxAge + ", stale-while-revalidate=86400"
    );
  } else {
    res.setHeader("Cache-Control", "no-store");
  }
  res.end(JSON.stringify(payload));
}

function readRepoParam(req) {
  const q = req.query || {};
  const v = q.repo;
  if (typeof v === "string" && v) return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string" && v[0]) return v[0].trim();

  const url = String(req.url || "");
  const i = url.indexOf("?");
  if (i < 0) return "";
  const search = url.slice(i + 1);
  const marker = "repo=";
  const j = search.indexOf(marker);
  if (j < 0) return "";
  let raw = search.slice(j + marker.length);
  const amp = raw.indexOf("&");
  if (amp >= 0) raw = raw.slice(0, amp);
  try {
    return decodeURIComponent(raw.replace(/\+/g, "%20")).trim();
  } catch (e) {
    return "";
  }
}

/** 去掉描述里的 :emoji_shortcode:（只在独立词位置替换，不影响「关键词: 值」这类写法） */
function cleanDescription(text) {
  if (!text) return "";
  return String(text)
    .replace(/(^|\s):([a-z0-9_+-]{2,}):(\s|$)/gi, "$1$3")
    .trim();
}

async function fetchRepo(repo) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "yujing-blog-card",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = "Bearer " + token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(GH_API + "/repos/" + repo, {
      headers: headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return json(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  const repo = readRepoParam(req);
  if (!repo || !REPO_RE.test(repo)) {
    return json(res, 400, { ok: false, error: "缺少或非法的 repo 参数，应为 owner/name" });
  }

  const owner = repo.split("/")[0].toLowerCase();
  if (allowedOwners().indexOf(owner) === -1) {
    return json(res, 403, {
      ok: false,
      error: "该仓库不在卡片白名单内（可由环境变量 GH_CARD_OWNERS 追加）",
    });
  }

  const key = repo.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expire > Date.now()) {
    return json(res, 200, hit.data, 1800);
  }

  let upstream;
  try {
    upstream = await fetchRepo(repo);
  } catch (e) {
    return json(res, 502, {
      ok: false,
      error: "连接 GitHub 失败：" + (e && e.message ? e.message : "unknown"),
    });
  }

  if (!upstream.ok) {
    const status = upstream.status === 404 ? 404 : upstream.status === 403 ? 502 : 502;
    return json(res, status, {
      ok: false,
      error:
        upstream.status === 404
          ? "仓库不存在或不可见"
          : "GitHub 返回 " + upstream.status + "（可能是速率限制）",
    });
  }

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    return json(res, 502, { ok: false, error: "GitHub 返回内容无法解析" });
  }

  // 私有仓库不对外暴露
  if (data && data.private === true) {
    return json(res, 404, { ok: false, error: "仓库不存在或不可见" });
  }

  const payload = {
    ok: true,
    repo: String(data.full_name || repo),
    description: cleanDescription(data.description),
    language: data.language || "",
    stars: Number(data.stargazers_count || 0),
    forks: Number(data.forks_count || 0),
    // GitHub 对「识别不出许可证」会返回 spdx_id = NOASSERTION，卡片上按「无」处理
    license:
      data.license && data.license.spdx_id && data.license.spdx_id !== "NOASSERTION"
        ? data.license.spdx_id
        : "",
    avatar: (data.owner && data.owner.avatar_url) || "",
    html_url: data.html_url || "https://github.com/" + repo,
    archived: data.archived === true,
  };

  cache.set(key, { data: payload, expire: Date.now() + CACHE_TTL_MS });
  return json(res, 200, payload, 1800);
};
