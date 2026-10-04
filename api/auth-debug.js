const crypto = require("crypto");

const COOKIE_NAME = "yuj_ed";

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

function verifyToken(token) {
  if (!token) return { ok: false, reason: "no token" };
  const i = token.indexOf(".");
  if (i <= 0) return { ok: false, reason: "no dot in token" };
  const exp = Number(token.slice(0, i));
  const sig = token.slice(i + 1);
  if (!Number.isFinite(exp)) return { ok: false, reason: "exp not a number" };
  if (exp <= Date.now()) return { ok: false, reason: "expired", exp: exp, now: Date.now() };
  const expect = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length) return { ok: false, reason: "length mismatch", aLen: a.length, bLen: b.length };
  const match = crypto.timingSafeEqual(a, b);
  return { ok: match, reason: match ? "ok" : "sig mismatch", sigPreview: sig.slice(0, 10), expectPreview: expect.slice(0, 10) };
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const token = req.headers["x-debug-token"] || "";
  const result = verifyToken(token);

  const out = {
    hasSecret: !!process.env.EDITOR_SECRET,
    hasPassword: !!process.env.EDITOR_PASSWORD,
    tokenLength: token.length,
    tokenPreview: token ? token.slice(0, 30) : "(none)",
    verification: result,
    signingKeyPreview: signingKey().toString("hex").slice(0, 16)
  };

  res.end(JSON.stringify(out));
};
