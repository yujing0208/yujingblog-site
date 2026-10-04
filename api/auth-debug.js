const crypto = require("crypto");

function signingKey() {
  const raw = process.env.EDITOR_SECRET || "";
  const fallback = process.env.EDITOR_PASSWORD || "";
  return crypto.createHash("sha256").update("yuj-editor|" + (raw || fallback)).digest("hex").slice(0, 16);
}

function pwHash() {
  const p = process.env.EDITOR_PASSWORD || "";
  return p ? crypto.createHash("sha256").update(p).digest("hex").slice(0, 16) : "(empty)";
}

function secretHash() {
  const s = process.env.EDITOR_SECRET || "";
  return s ? crypto.createHash("sha256").update(s).digest("hex").slice(0, 16) : "(empty)";
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const out = {
    hasSecret: !!process.env.EDITOR_SECRET,
    hasPassword: !!process.env.EDITOR_PASSWORD,
    secretHash: secretHash(),
    passwordHash: pwHash(),
    signingKeyHash: signingKey(),
    cookieHeader: req.headers.cookie || "(none)",
    method: req.method,
    url: req.url
  };
  res.end(JSON.stringify(out));
};
