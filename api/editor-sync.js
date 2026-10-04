/**
 * Vercel Serverless Function —— 内容仓库 → 站点仓库 的同步桥（编辑器专用，v1）
 *
 * 解决的问题：
 *   在线编辑器把改动 commit 到「内容仓库 yujingblog-content(master)」，
 *   但线上站点是由「站点仓库 yujingblog-site(main)」的 Vercel Git 部署线构建的。
 *   两者之间原先只靠站点仓库的 Mirror Content 定时 workflow（每 30 分钟）桥接，
 *   一旦 workflow 拿不到读私有内容仓库的 PAT 就会整条链断掉 ——
 *   表现为编辑器提示"推送成功"而线上永远不更新。
 *
 * 本函数的职责：在编辑器推送成功后，**立刻**把内容仓库 master 的 HEAD 写进
 * 站点仓库的 content-sha.txt 并推一个 mirror commit 到站点仓库 main，
 * 由 Vercel Git 部署线构建上线（构建期 prebuild 的 sync-content.js 会按该 sha
 * 把内容仓库拉进产物）。秒级生效，不再依赖定时轮询。
 *
 * 鉴权：与 /api/editor-github 同源 —— /api/editor-auth 下发的签名 Cookie，
 * 浏览器不持有任何 GitHub Token。
 *
 * 环境变量：EDITOR_GITHUB_TOKEN 优先，回退 GH_TOKEN / GITHUB_TOKEN。
 *
 * 注意：本文件必须使用 CommonJS（module.exports）。
 */

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

/** 直接用服务端 token 调 GitHub（不走 editor-github 代理） */
function ghCall(path, init) {
  const token = ghToken();
  if (!token) throw new Error("服务端未配置 EDITOR_GITHUB_TOKEN / GH_TOKEN");
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "User-Agent": "yujing-blog-editor-sync",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  let body = init && init.body;
  if (body) headers["Content-Type"] = "application/json";
  return fetch(GH_API + path, Object.assign({}, init || {}, { headers, body }));
}

async function readContentSha() {
  const r = await ghCall(
    "/repos/" + OWNER + "/" + SITE_REPO + "/contents/content-sha.txt?ref=" + SITE_BRANCH
  );
  if (r.status === 404) return "";
  if (!r.ok) throw new Error("读取站点仓库 content-sha.txt 失败：" + r.status);
  const j = await r.json();
  if (!j || !j.content) return "";
  return Buffer.from(j.content, "base64").toString("utf8").trim();
}

async function contentHeadSha() {
  // GET 单引用端点用单数 /git/ref/heads/{branch}
  const r = await ghCall("/repos/" + OWNER + "/" + CONTENT_REPO + "/git/ref/heads/" + CONTENT_BRANCH);
  if (!r.ok) throw new Error("读取内容仓库 HEAD 失败：" + r.status);
  const j = await r.json();
  if (!j || !j.object) throw new Error("内容仓库 ref 返回异常");
  return j.object.sha;
}

/** 建一个只含 content-sha.txt 的最小 commit 并推到站点仓库 main */
async function pushMirrorCommit(contentSha) {
  const siteRefR = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/ref/heads/" + SITE_BRANCH);
  if (!siteRefR.ok) throw new Error("读取站点仓库 ref 失败：" + siteRefR.status);
  const siteRef = await siteRefR.json();
  const parentSha = siteRef.object.sha;

  const commitR = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/commits/" + parentSha);
  if (!commitR.ok) throw new Error("读取站点仓库 commit 失败：" + commitR.status);
  const parent = await commitR.json();
  if (!parent.tree) throw new Error("站点仓库 commit 缺少 tree");

  const blobR = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/blobs", {
    method: "POST",
    body: JSON.stringify({ content: contentSha + "\n", encoding: "utf8" }),
  });
  if (!blobR.ok) throw new Error("创建 blob 失败：" + blobR.status);
  const blob = await blobR.json();

  const treeR = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: [{ path: "content-sha.txt", mode: "100644", type: "blob", sha: blob.sha }],
    }),
  });
  if (!treeR.ok) throw new Error("创建 tree 失败：" + treeR.status);
  const tree = await treeR.json();

  const commitR2 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: "chore(content-mirror): sync content @" + contentSha.slice(0, 7),
      tree: tree.sha,
      parents: [parentSha],
    }),
  });
  if (!commitR2.ok) throw new Error("创建 commit 失败：" + commitR2.status);
  const commit = await commitR2.json();

  // 更新引用（PATCH 端点为复数 /git/refs/heads/）
  const updR = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/refs/heads/" + SITE_BRANCH, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });
  if (!updR.ok) throw new Error("更新站点仓库 ref 失败：" + updR.status);

  return commit.sha;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!isAuthed(req)) {
    return json(res, 401, { message: "未登录或登录已过期，请重新输入编辑密码" });
  }

  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { message: "Method Not Allowed" });
  }

  try {
    if (!ghToken()) throw new Error("服务端未配置 EDITOR_GITHUB_TOKEN / GH_TOKEN");

    const contentSha = await contentHeadSha();
    if (!contentSha) throw new Error("取不到内容仓库 HEAD");

    const last = await readContentSha();
    if (last === contentSha) {
      return json(res, 200, { synced: true, contentSha: contentSha, siteCommit: null, reason: "内容仓库与站点记录一致" });
    }

    // 并行获取站点 ref + 创建 blob（无依赖）
    const [siteRefResp, blobResp] = await Promise.all([
      ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/ref/heads/" + SITE_BRANCH),
      ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/blobs", {
        method: "POST",
        body: JSON.stringify({ content: contentSha + "\n", encoding: "utf8" }),
      }),
    ]);

    if (!siteRefResp.ok) throw new Error("读取站点仓库 ref 失败：" + siteRefResp.status);
    const siteRef = await siteRefResp.json();
    const parentSha = siteRef.object.sha;

    if (!blobResp.ok) throw new Error("创建 blob 失败：" + blobResp.status);
    const blob = await blobResp.json();

    // 获取父 commit（依赖 parentSha）
    const commitR = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/commits/" + parentSha);
    if (!commitR.ok) throw new Error("读取站点仓库 commit 失败：" + commitR.status);
    const parent = await commitR.json();
    if (!parent.tree) throw new Error("站点仓库 commit 缺少 tree");

    // 创建 tree
    const treeR = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/trees", {
      method: "POST",
      body: JSON.stringify({
        base_tree: parent.tree.sha,
        tree: [{ path: "content-sha.txt", mode: "100644", type: "blob", sha: blob.sha }],
      }),
    });
    if (!treeR.ok) throw new Error("创建 tree 失败：" + treeR.status);
    const tree = await treeR.json();

    // 创建 commit
    const commitR2 = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/commits", {
      method: "POST",
      body: JSON.stringify({
        message: "chore(content-mirror): sync content @" + contentSha.slice(0, 7),
        tree: tree.sha,
        parents: [parentSha],
      }),
    });
    if (!commitR2.ok) throw new Error("创建 commit 失败：" + commitR2.status);
    const commit = await commitR2.json();

    // 更新引用
    const updR = await ghCall("/repos/" + OWNER + "/" + SITE_REPO + "/git/refs/heads/" + SITE_BRANCH, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    });
    if (!updR.ok) throw new Error("更新站点仓库 ref 失败：" + updR.status);

    const siteCommit = commit.sha;
    return json(res, 200, { synced: false, contentSha: contentSha, siteCommit: siteCommit, reason: "已推送镜像 commit，等待 Vercel 构建" });
  } catch (e) {
    return json(res, 500, { message: "同步失败：" + (e && e.message ? e.message : "unknown") });
  }
};
