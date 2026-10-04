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
  if (Buffer.from(sig).length !== expect.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), expect);
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
  return verifyToken(parseCookies(req.headers && req.headers.cookie)[COOKIE_NAME] || "");
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

module.exports = async function handler(req, res) {
  const steps = [];
  function l(s) { steps.push(s); }

  try {
    l("1:start");
    if (!isAuthed(req)) {
      l("2:auth-fail");
      return json(res, 401, { ok: false, steps });
    }
    l("2:auth-ok");

    if (!ghToken()) throw new Error("no token");
    l("3:token-ok");

    // Get content HEAD
    l("4:contentHeadSha");
    const r1 = await ghCall("/repos/" + OWNER + "/" + CONTENT_REPO + "/git/ref/heads/" + CONTENT_BRANCH);
    l("4:status=" + r1.status);
    if (!r1.ok) throw new Error("content HEAD failed");
    const j1 = await r1.json();
    const contentSha = j1.object?.sha;
    l("4:sha=" + contentSha);
    if (!contentSha) throw new Error("no sha");

    // Read last content-sha
    l("5:readContentSha");
    const r2 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/contents/content-sha.txt?ref=" + SITE_BRANCH);
    let last = "";
    if (r2.ok) {
      const j2 = await r2.json();
      last = Buffer.from(j2.content, "base64").toString("utf8").trim();
    }
    l("5:last=" + last);

    if (last === contentSha) {
      l("5:unchanged");
      return json(res, 200, { ok: true, synced: true, contentSha, steps });
    }

    // Parallel: get ref + create blob
    l("6:parallel-ref-blob");
    const [refResp, blobResp] = await Promise.all([
      ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/ref/heads/" + SITE_BRANCH),
      ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/blobs", {
        method: "POST",
        body: JSON.stringify({ content: contentSha + "\n", encoding: "utf8" }),
      }),
    ]);
    l("6:ref=" + refResp.status + "+blob=" + blobResp.status);

    if (!refResp.ok) throw new Error("ref failed");
    if (!blobResp.ok) throw new Error("blob failed");

    const siteRef = await refResp.json();
    const blob = await blobResp.json();
    const parentSha = siteRef.object.sha;
    l("6:parentSha=" + parentSha);

    // Get parent commit
    l("7:get-parent-commit");
    const r3 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/commits/" + parentSha);
    l("7:status=" + r3.status);
    if (!r3.ok) throw new Error("parent commit failed");
    const parent = await r3.json();
    l("7:tree=" + parent.tree?.sha);

    // Create tree
    l("8:create-tree");
    const r4 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/trees", {
      method: "POST",
      body: JSON.stringify({
        base_tree: parent.tree.sha,
        tree: [{ path: "content-sha.txt", mode: "100644", type: "blob", sha: blob.sha }],
      }),
    });
    l("8:status=" + r4.status);
    if (!r4.ok) throw new Error("tree failed");
    const tree = await r4.json();
    l("8:tree=" + tree.sha);

    // Create commit
    l("9:create-commit");
    const r5 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/commits", {
      method: "POST",
      body: JSON.stringify({
        message: "chore(content-mirror): sync content @" + contentSha.slice(0, 7),
        tree: tree.sha,
        parents: [parentSha],
      }),
    });
    l("9:status=" + r5.status);
    if (!r5.ok) throw new Error("commit failed");
    const commit = await r5.json();
    l("9:commit=" + commit.sha);

    // Update ref
    l("10:update-ref");
    const r6 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/refs/heads/" + SITE_BRANCH, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    });
    l("10:status=" + r6.status);
    if (!r6.ok) throw new Error("ref update failed");

    l("11:done");
    return json(res, 200, { ok: true, synced: false, contentSha, siteCommit: commit.sha, steps });
  } catch (e) {
    l("ERROR:" + e.message);
    return json(res, 500, { ok: false, message: e.message, steps });
  }
};
