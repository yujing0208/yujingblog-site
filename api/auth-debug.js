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

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  
  const cookieHeader = req.headers.cookie || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME] || "";
  
  const out = {
    hasSecret: !!process.env.EDITOR_SECRET,
    hasPassword: !!process.env.EDITOR_PASSWORD,
    cookieHeaderPresent: !!cookieHeader,
    cookieHeaderValue: cookieHeader ? cookieHeader.slice(0, 80) : "(none)",
    tokenFound: !!token,
    tokenLength: token.length,
    tokenPreview: token ? token.slice(0, 20) + "..." : "(none)",
    allHeaders: req.headers
  };
  
  if (token) {
    const i = token.indexOf(".");
    out.dotPosition = i;
    if (i > 0) {
      const exp = Number(token.slice(0, i));
      const sig = token.slice(i + 1);
      out.expValue = exp;
      out.now = Date.now();
      out.expValid = exp > Date.now();
      const expect = sign(exp);
      out.sigMatch = sig === expect;
      out.sigLength = sig.length;
      out.expectLength = expect.length;
      out.sigPreview = sig.slice(0, 20);
      out.expectPreview = expect.slice(0, 20);
    }
  }
  
  res.end(JSON.stringify(out));
};
