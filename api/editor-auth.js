/**
 * Vercel Serverless Function — 编辑器密码登录
 *
 * 作用：把「每次编辑都要粘贴 GitHub Token」换成「输一次密码」。
 *   POST   /api/editor-auth  { password }  → 校验密码，通过则下发签名 Cookie
 *   GET    /api/editor-auth                → 查询当前是否已登录 { ok }
 *   DELETE /api/editor-auth                → 退出登录，清除 Cookie
 *
 * Cookie：HttpOnly + SameSite=Strict，前端 JS 读不到，也就无法被 XSS 偷走。
 * 有效期 30 天，所以正常情况下不用反复输入。
 *
 * 环境变量：
 * - EDITOR_PASSWORD  必填。你进入编辑页要输的那个密码。
 * - EDITOR_SECRET    可选。Cookie 签名密钥；不配置时用 EDITOR_PASSWORD 派生。
 * - EDITOR_NAME      可选。登录后显示的昵称，默认「编辑」。
 *
 * 注意：本文件必须使用 CommonJS（module.exports），原因见 api/chat.js 顶部注释。
 * Vercel Serverless Function 对 ESM(.js + type:module) 存在打包/加载兼容问题。
 */

const crypto = require("crypto");

const COOKIE_NAME = "yuj_ed";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 天
const FAIL_DELAY_MS = 400;
const MAX_FAILS = 5;
const LOCK_MS = 60 * 1000;

/** 签名密钥：优先 EDITOR_SECRET，缺省用 EDITOR_PASSWORD 派生，保证只配一个变量也能跑 */
function signingKey() {
  const raw = process.env.EDITOR_SECRET || "";
  const fallback = process.env.EDITOR_PASSWORD || "";
  return crypto.createHash("sha256").update("yuj-editor|" + (raw || fallback)).digest();
}

function sign(exp) {
  return crypto.createHmac("sha256", signingKey()).update(String(exp)).digest("base64url");
}

function makeToken(maxAgeSeconds) {
  const exp = Date.now() + maxAgeSeconds * 1000;
  return exp + "." + sign(exp);
}

function equalString(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
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

function readToken(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  return cookies[COOKIE_NAME] || "";
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

function isHttps(req) {
  const proto = String((req.headers && req.headers["x-forwarded-proto"]) || "")
    .split(",")[0]
    .trim();
  return proto === "https";
}

function cookieAttrs(req, maxAge) {
  // 本地 http 调试时不加 Secure，否则浏览器不会保存
  return (
    "; Path=/; Max-Age=" +
    maxAge +
    "; HttpOnly; SameSite=Strict" +
    (isHttps(req) ? "; Secure" : "")
  );
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
    return Promise.resolve(req.body);
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 进程内失败计数（Serverless 多实例下只是尽力而为的减速带，不是硬防线）
const fails = new Map();

function clientIp(req) {
  const fwd = String((req.headers && req.headers["x-forwarded-for"]) || "");
  const first = fwd.split(",")[0].trim();
  return first || "unknown";
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const method = String(req.method || "GET").toUpperCase();

  if (method === "GET" || method === "HEAD") {
    const ok = verifyToken(readToken(req));
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: ok, login: ok ? process.env.EDITOR_NAME || "编辑" : null }));
    return;
  }

  if (method === "DELETE") {
    res.setHeader("Set-Cookie", COOKIE_NAME + "=" + cookieAttrs(req, 0));
    return json(res, 200, { ok: false });
  }

  if (method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return json(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  const expected = process.env.EDITOR_PASSWORD || "";
  if (!expected) {
    return json(res, 500, { ok: false, error: "服务端未配置 EDITOR_PASSWORD" });
  }

  const ip = clientIp(req);
  const now = Date.now();
  const rec = fails.get(ip) || { count: 0, until: 0 };
  if (rec.until > now) {
    const wait = Math.ceil((rec.until - now) / 1000);
    return json(res, 429, { ok: false, error: "尝试过于频繁，请 " + wait + " 秒后再试" });
  }

  let password = "";
  try {
    const raw = await readRequestBody(req);
    const body = raw === null || raw === "" ? {} : typeof raw === "object" ? raw : JSON.parse(raw);
    password = typeof body.password === "string" ? body.password : "";
  } catch (e) {
    password = "";
  }

  if (!password || !equalString(password, expected)) {
    rec.count += 1;
    if (rec.count >= MAX_FAILS) {
      rec.until = now + LOCK_MS;
      rec.count = 0;
    }
    fails.set(ip, rec);
    await delay(FAIL_DELAY_MS);
    return json(res, 401, { ok: false, error: "密码错误" });
  }

  fails.delete(ip);

  const token = makeToken(MAX_AGE_SECONDS);
  res.setHeader("Set-Cookie", COOKIE_NAME + "=" + token + cookieAttrs(req, MAX_AGE_SECONDS));
  return json(res, 200, { ok: true, login: process.env.EDITOR_NAME || "编辑" });
};
