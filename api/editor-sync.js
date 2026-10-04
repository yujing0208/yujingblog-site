/**
 * Diagnostic version - minimal, just returns env + crypto check
 */
const crypto = require("crypto");

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  
  const diag = {
    nodeVersion: process.version,
    hasCrypto: typeof crypto.createHmac === "function",
    hasFetch: typeof fetch === "function",
    env_EDITOR_GITHUB_TOKEN: process.env.EDITOR_GITHUB_TOKEN ? "SET(len=" + process.env.EDITOR_GITHUB_TOKEN.length + ")" : "MISSING",
    env_GH_TOKEN: process.env.GH_TOKEN ? "SET(len=" + process.env.GH_TOKEN.length + ")" : "MISSING",
    env_GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "SET(len=" + process.env.GITHUB_TOKEN.length + ")" : "MISSING",
    env_EDITOR_PASSWORD: process.env.EDITOR_PASSWORD ? "SET(len=" + process.env.EDITOR_PASSWORD.length + ")" : "MISSING",
    env_EDITOR_SECRET: process.env.EDITOR_SECRET ? "SET" : "MISSING",
  };

  // Test crypto
  try {
    const key = crypto.createHash("sha256").update("test").digest();
    diag.cryptoHash = "ok:" + key.length;
  } catch (e) {
    diag.cryptoHash = "FAIL:" + e.message;
  }

  // Test fetch to GitHub
  try {
    const token = process.env.EDITOR_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
    if (!token) {
      diag.fetchTest = "SKIPPED(no token)";
    } else {
      const r = await fetch("https://api.github.com/repos/yujing0208/yujingblog-content/git/ref/heads/master", {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "User-Agent": "diag",
        },
      });
      diag.fetchTest = "status:" + r.status;
      if (r.ok) {
        const j = await r.json();
        diag.contentHead = j.object?.sha;
      }
    }
  } catch (e) {
    diag.fetchTest = "FAIL:" + e.message;
  }

  return json(res, 200, diag);
};
