/**
 * Vercel Serverless Function — 编辑器专用 GitHub 代理（v3 收紧版）
 *
 * 前端不再持有任何 GitHub Token：浏览器只请求 /api/editor-github，
 * 由本函数带上服务端的 Token 去调 api.github.com。
 *
 * 调用形态：/api/editor-github?path=<encodeURIComponent("/repos/...")>
 * 请求方法原样透传（GET / PUT / POST / PATCH / DELETE）。
 *
 * 安全边界 v3（v4 规格 §9.1 / §9.2）：
 * 1. 必须先通过 /api/editor-auth 下发的签名 Cookie；
 * 2. 路径只允许编辑器工作需要的两类：
 *    - /repos/yujing0208/yujingblog-content/**  → 内容仓，读写（contents/git/commits）
 *    - /repos/yujing0208/yujingblog-site/**     → 站点仓，**只读 GET**（站点仓永不被编辑器写入）
 *    - 不再允许 /user 及其它任何路径；
 * 3. 方法只允许读写文件的 5 种；不允许访问 /orgs、/user/repos 等。
 *
 * 环境变量：
 * - EDITOR_GITHUB_TOKEN 优先；未配置时回退 GH_TOKEN / GITHUB_TOKEN（兼容现有配置）。
 *   需对内容仓有 Contents 读写权限、对站点仓只读。
 *
 * 注意：本文件必须使用 CommonJS（module.exports），原因见 api/chat.js 顶部注释。
 */

const crypto = require("crypto");

const COOKIE_NAME = "yuj_ed";
const OWNER = "yujing0208";
const CONTENT_REPO = "yujingblog-content";
const SITE_REPO = "yujingblog-site";
const ALLOWED_METHODS = ["GET", "PUT", "POST", "PATCH", "DELETE"];
const GH_API = "https://api.github.com";

function signingKey() {
  const raw = process.env.EDITOR_SECRET || "";
  const fallback = process.env.EDITOR_PASSWORD || "";
  return crypto.createHash("sha256").update("yuj-editor|" + (raw || fallback)).digest();
}

function sign(exp) {
  return crypto.createHmac("sha256", signingKey()).update(String(exp)).digest("base64url");
}

function verifyToken(token) {
  if (!token) return false;
  const i = token.indexOf(".");
  if (i <= 0) return false;

  const exp = Number(token.slice(0, i));
  const sig = token.slice(i + 1);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;

  const expect = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  String(header)
    .split(";")
    .forEach((part) => {
      const i = part.indexOf("=");
      if (i < 0) return;
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      if (k) out[k] = v;
    });
  return out;
}

function isAuthed(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  return verifyToken(cookies[COOKIE_NAME] || "");
}

/** 从 req.query 或原始 url 中取出 path 参数（保留其内部自带的 query） */
function readPathParam(req) {
  const q = req.query || {};
  const v = q.path;
  if (typeof v === "string" && v) return v;
  if (Array.isArray(v) && typeof v[0] === "string" && v[0]) return v[0];

  const url = String(req.url || "");
  const i = url.indexOf("?");
  if (i < 0) return "";
  const search = url.slice(i + 1);
  const marker = "path=";
  const j = search.indexOf(marker);
  if (j < 0) return "";
  let raw = search.slice(j + marker.length);
  const amp = raw.indexOf("&");
  if (amp >= 0) raw = raw.slice(0, amp);
  try {
    return decodeURIComponent(raw.replace(/\+/g, "%20"));
  } catch (e) {
    return "";
  }
}

/** v3 白名单：按仓库 + 方法收口 */
function checkAllowed(p, method) {
  if (p.indexOf("..") !== -1) return false; // 路径穿越防护
  const contentPrefix = "/repos/" + OWNER + "/" + CONTENT_REPO + "/";
  const sitePrefix = "/repos/" + OWNER + "/" + SITE_REPO + "/";
  const contentExact = "/repos/" + OWNER + "/" + CONTENT_REPO;
  const siteExact = "/repos/" + OWNER + "/" + SITE_REPO;
  if (p === contentExact || p.indexOf(contentPrefix) === 0) return true; // 内容仓：5 种方法都放行
  if (p === siteExact || p.indexOf(sitePrefix) === 0) return method === "GET"; // 站点仓：只读
  return false;
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString("utf8"));
    if (typeof req.body === "string") return Promise.resolve(req.body);
    return Promise.resolve(JSON.stringify(req.body));
  }
  if (req.readableEnded) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      if (chunks.length === 0) resolve(null);
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!isAuthed(req)) {
    return json(res, 401, { message: "未登录或登录已过期，请重新输入编辑密码" });
  }

  const method = String(req.method || "GET").toUpperCase();
  if (ALLOWED_METHODS.indexOf(method) === -1) {
    res.setHeader("Allow", ALLOWED_METHODS.join(", "));
    return json(res, 405, { message: "Method Not Allowed" });
  }

  const token =
    process.env.EDITOR_GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    "";
  if (!token) {
    return json(res, 500, { message: "服务端未配置 EDITOR_GITHUB_TOKEN / GH_TOKEN" });
  }

  const rawPath = readPathParam(req);
  if (!rawPath || rawPath.charAt(0) !== "/") {
    return json(res, 400, { message: "缺少 path 参数" });
  }

  const qm = rawPath.indexOf("?");
  const path = qm >= 0 ? rawPath.slice(0, qm) : rawPath;
  const search = qm >= 0 ? rawPath.slice(qm) : "";

  if (!checkAllowed(path, method)) {
    return json(res, 403, { message: "该路径或方法不在编辑器允许范围内：" + method + " " + path });
  }

  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "User-Agent": "yujing-blog-editor",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const init = { method: method, headers: headers };

  if (method !== "GET") {
    const body = await readRequestBody(req);
    headers["Content-Type"] = "application/json";
    init.body = body === null || body === undefined ? "{}" : body;
  }

  let upstream;
  try {
    upstream = await fetch(GH_API + path + search, init);
  } catch (e) {
    return json(res, 502, { message: "连接 GitHub 失败：" + (e && e.message ? e.message : "unknown") });
  }

  const text = await upstream.text();
  res.statusCode = upstream.status;
  res.setHeader(
    "Content-Type",
    upstream.headers.get("content-type") || "application/json; charset=utf-8"
  );
  res.end(text);
};
