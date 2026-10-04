module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const cookieHeader = req.headers.cookie || "";
  const cookies = {};
  cookieHeader.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i < 0) return;
    cookies[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });

  const token = cookies["yuj_ed"] || "";
  const i = token.indexOf(".");
  const exp = i > 0 ? Number(token.slice(0, i)) : 0;

  const crypto = require("crypto");
  const raw = process.env.EDITOR_SECRET || "";
  const fallback = process.env.EDITOR_PASSWORD || "";
  const key = crypto.createHash("sha256").update("yuj-editor|" + (raw || fallback)).digest();
  const expectSig = i > 0 ? crypto.createHmac("sha256", key).update(token.slice(0, i)).digest("base64url") : "";
  const actualSig = i > 0 ? token.slice(i + 1) : "";

  const ghToken = process.env.EDITOR_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

  res.end(JSON.stringify({
    cookiePresent: token !== "",
    expExpired: exp <= Date.now(),
    secretEmpty: raw === "",
    passwordLen: fallback.length,
    sigMatch: expectSig === actualSig && token !== "",
    ghTokenPresent: ghToken !== "",
  }));
};