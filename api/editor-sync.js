const crypto = require("crypto");

const COOKIE_NAME = "yuj_ed";
const OWNER = "yujing0208";
const CONTENT_REPO = "yujingblog-content";
const SITE_REPO = "yujingblog-site";
const CONTENT_BRANCH = "master";
const SITE_BRANCH = "main";
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
  if (!token) throw new Error("no token");
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "User-Agent": "sync",
  };
  let body = init && init.body;
  if (body) headers["Content-Type"] = "application/json";
  return fetch(GH_API + path, Object.assign({}, init || {}, { headers, body }));
}

module.exports = async function handler(req, res) {
  const steps = [];
  function l(s) { steps.push(s); }

  try {
    // Step 1: auth check
    const cookieHeader = req.headers.cookie || "";
    const cookies = parseCookies(cookieHeader);
    const token = cookies[COOKIE_NAME] || "";
    l("auth: token=" + (token ? token.substring(0, 20) + "..." : "MISSING"));
    const authed = verifyToken(token);
    l("auth: verified=" + authed);
    if (!authed) {
      l("auth: FAIL - returning 401");
      return json(res, 401, { ok: false, message: "未登录", steps });
    }

    // Step 2: token check
    const tk = ghToken();
    l("ghToken: " + (tk ? "SET(len=" + tk.length + ")" : "MISSING"));

    // Step 3: contentHeadSha
    l("step3: fetching content HEAD...");
    const r1 = await ghCall("/repos/" + OWNER + "/" + CONTENT_REPO + "/git/ref/heads/" + CONTENT_BRANCH);
    l("step3: status=" + r1.status);
    if (!r1.ok) throw new Error("content HEAD failed: " + r1.status);
    const j1 = await r1.json();
    const contentSha = j1.object?.sha;
    l("step3: contentSha=" + contentSha);
    if (!contentSha) throw new Error("no content sha");

    // Step 4: readContentSha
    l("step4: fetching site content-sha.txt...");
    const r2 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/contents/content-sha.txt?ref=" + SITE_BRANCH);
    l("step4: status=" + r2.status);
    let last = "";
    if (r2.ok) {
      const j2 = await r2.json();
      last = Buffer.from(j2.content, "base64").toString("utf8").trim();
    }
    l("step4: last=" + last);

    if (last === contentSha) {
      l("step4: content unchanged, returning synced=true");
      return json(res, 200, { ok: true, synced: true, contentSha, steps });
    }

    // Step 5: parallel fetch ref + create blob
    l("step5: parallel ref+blob...");
    const [refResp, blobResp] = await Promise.all([
      ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/ref/heads/" + SITE_BRANCH),
      ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/blobs", {
        method: "POST",
        body: JSON.stringify({ content: contentSha + "\n", encoding: "utf8" }),
      }),
    ]);
    l("step5: ref=" + refResp.status + " blob=" + blobResp.status);

    if (!refResp.ok) throw new Error("ref failed: " + refResp.status);
    if (!blobResp.ok) throw new Error("blob failed: " + blobResp.status);

    const siteRef = await refResp.json();
    const blob = await blobResp.json();
    const parentSha = siteRef.object.sha;

    // Step 6: get parent commit
    l("step6: get parent commit...");
    const r3 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/commits/" + parentSha);
    l("step6: status=" + r3.status);
    if (!r3.ok) throw new Error("parent commit failed: " + r3.status);
    const parent = await r3.json();
    l("step6: tree=" + parent.tree?.sha);

    // Step 7: create tree
    l("step7: create tree...");
    const r4 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/trees", {
      method: "POST",
      body: JSON.stringify({
        base_tree: parent.tree.sha,
        tree: [{ path: "content-sha.txt", mode: "100644", type: "blob", sha: blob.sha }],
      }),
    });
    l("step7: status=" + r4.status);
    if (!r4.ok) throw new Error("tree failed: " + r4.status);
    const tree = await r4.json();

    // Step 8: create commit
    l("step8: create commit...");
    const r5 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/commits", {
      method: "POST",
      body: JSON.stringify({
        message: "chore(content-mirror): sync content @" + contentSha.slice(0, 7),
        tree: tree.sha,
        parents: [parentSha],
      }),
    });
    l("step8: status=" + r5.status);
    if (!r5.ok) throw new Error("commit failed: " + r5.status);
    const commit = await r5.json();

    // Step 9: update ref
    l("step9: update ref...");
    const r6 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/refs/heads/" + SITE_BRANCH, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    });
    l("step9: status=" + r6.status);
    if (!r6.ok) throw new Error("ref update failed: " + r6.status);

    l("DONE!");
    return json(res, 200, { ok: true, synced: false, contentSha, siteCommit: commit.sha, steps });
  } catch (e) {
    l("ERROR: " + e.message);
    return json(res, 500, { ok: false, message: e.message, steps });
  }
};
