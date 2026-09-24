/**
 * Vercel Serverless Function — 编辑器专用 GitHub 代理
 *
 * 前端不再持有任何 GitHub Token：浏览器只请求 /api/editor-github，
 * 由本函数带上服务端的 GH_TOKEN 去调 api.github.com。
 *
 * 调用形态：/api/editor-github?path=<encodeURIComponent("/repos/...")>
 * 请求方法原样透传（GET / PUT / POST / PATCH / DELETE）。
 *
 * 安全边界（故意收窄，就算密码泄露也伤不到别的仓库）：
 * 1. 必须先通过 /api/editor-auth 下发的签名 Cookie；
 * 2. path 只允许 /user 与 /repos/yujing0208/{yujingblog-content,yujingblog-site}/**；
 * 3. 方法只允许读写文件的 5 种；不允许访问 /orgs、/user/repos 等。
 *
 * 环境变量：GH_TOKEN（GitHub PAT，需对上面两个仓库有 Contents 读写权限）
 *
 * 注意：本文件必须使用 CommonJS（module.exports），原因见 api/chat.js 顶部注释。
 */

const crypto = require("crypto");

const COOKIE_NAME = "yuj_ed";
const ALLOWED_REPOS = ["yujingblog-content", "yujingblog-site"];
const ALLOWED_EXACT = ["/user"];
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

function isAllowedPath(p) {
  if (ALLOWED_EXACT.indexOf(p) !== -1) return true;
  const prefix = "/repos/yujing0208/";
  if (!p.startsWith(prefix)) return false;
  const rest = p.slice(prefix.length);
  const repo = rest.split("/")[0];
  if (ALLOWED_REPOS.indexOf(repo) === -1) return false;
  // 防止 /repos/owner/repo/../other 之类的路径穿越
  return p.indexOf("..") === -1;
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

  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  if (!token) {
    return json(res, 500, { message: "服务端未配置 GH_TOKEN" });
  }

  const rawPath = readPathParam(req);
  if (!rawPath || rawPath.charAt(0) !== "/") {
    return json(res, 400, { message: "缺少 path 参数" });
  }

  const qm = rawPath.indexOf("?");
  const path = qm >= 0 ? rawPath.slice(0, qm) : rawPath;
  const search = qm >= 0 ? rawPath.slice(qm) : "";

  if (!isAllowedPath(path)) {
    return json(res, 403, { message: "该路径不在编辑器允许范围内：" + path });
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
