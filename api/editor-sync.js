/**
 * Ultra-minimal diagnostic - no auth, no fetch, just echo
 */
function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  return json(res, 200, {
    ok: true,
    method: req.method,
    url: req.url,
    headers: Object.keys(req.headers),
    nodeVersion: process.version,
    hasFetch: typeof fetch === "function",
    env: {
      EDITOR_GITHUB_TOKEN: process.env.EDITOR_GITHUB_TOKEN ? "SET" : "MISSING",
      GH_TOKEN: process.env.GH_TOKEN ? "SET" : "MISSING",
      EDITOR_PASSWORD: process.env.EDITOR_PASSWORD ? "SET" : "MISSING",
    }
  });
};
