const crypto = require("crypto");

const COOKIE_NAME = "yuj_ed";
const OWNER = "yujing0208";
const CONTENT_REPO = "yujingblog-content";
const SITE_REPO = "yujingblog-site";
const CONTENT_BRANCH = "master";
const SITE_BRANCH = "main";
const GH_API = "https://api.github.com";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function ghToken() {
  return process.env.EDITOR_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
}

function ghCall(path, init) {
  const token = ghToken();
  if (!token) throw new Error("服务端未配置 EDITOR_GITHUB_TOKEN / GH_TOKEN");
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "User-Agent": "yujing-blog-editor-sync",
  };
  let body = init && init.body;
  if (body) headers["Content-Type"] = "application/json";
  return fetch(GH_API + path, Object.assign({}, init || {}, { headers, body }));
}

// ---- Minimal test version ----
// First test: can we do the GitHub API calls without auth check?
// This isolates whether the issue is auth or fetch.

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  
  const diag = {
    step: "start",
    hasCrypto: typeof crypto !== "undefined",
    hasFetch: typeof fetch === "function",
    token: ghToken() ? "SET(len=" + ghToken().length + ")" : "MISSING",
    cookieHeader: req.headers.cookie ? "SET(len=" + req.headers.cookie.length + ")" : "MISSING",
  };

  // Try auth check separately
  try {
    const cookie = req.headers.cookie || "";
    const parts = cookie.split(";");
    let token = "";
    for (const part of parts) {
      const i = part.indexOf("=");
      if (i > 0 && part.slice(0, i).trim() === COOKIE_NAME) {
        token = part.slice(i + 1).trim();
      }
    }
    diag.cookieToken = token ? token.substring(0, 30) + "..." : "MISSING";
    
    if (token) {
      // Try minimal crypto
      const key = crypto.createHash("sha256").update("yuj-editor|test").digest();
      diag.cryptoHash = "ok:" + key.length;
      
      // Try hmac
      const hmac = crypto.createHmac("sha256", key).update("test").digest("base64url");
      diag.cryptoHmac = "ok:" + hmac.length;
      
      // Try full verify
      const i = token.indexOf(".");
      if (i > 0) {
        const exp = Number(token.slice(0, i));
        const sig = token.slice(i + 1);
        diag.tokenExp = exp;
        diag.tokenExpValid = Number.isFinite(exp) && exp > Date.now();
        diag.tokenSigLen = sig.length;
        
        // Compute expected signing key
        const raw = process.env.EDITOR_SECRET || "";
        const fallback = process.env.EDITOR_PASSWORD || "";
        const sKey = crypto.createHash("sha256").update("yuj-editor|" + (raw || fallback)).digest();
        diag.signingKeyLen = sKey.length;
        
        const expectSig = crypto.createHmac("sha256", sKey).update(String(exp)).digest("base64url");
        diag.expectSigLen = expectSig.length;
        diag.sigMatch = sig === expectSig;
      }
    }
    
    diag.authCheck = "passed";
  } catch (e) {
    diag.authCheck = "FAIL: " + e.message;
  }

  // Try GitHub API call
  try {
    if (!ghToken()) throw new Error("no token");
    const r = await ghCall("/repos/" + OWNER + "/" + CONTENT_REPO + "/git/ref/heads/" + CONTENT_BRANCH);
    diag.githubStatus = r.status;
    if (r.ok) {
      const j = await r.json();
      diag.contentHead = j.object?.sha;
    }
  } catch (e) {
    diag.githubError = e.message;
  }

  return json(res, 200, diag);
};
