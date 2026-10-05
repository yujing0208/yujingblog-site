#!/usr/bin/env node
// 从内容仓 content/data/friends.ts 生成站点仓 public/friend.json（FCLite 的数据源）
//
// 设计要点：
//  1. 真源是内容仓 master 的 content/data/friends.ts（站点仓 src/data/friends.ts 是过期副本，
//     构建时还会被 sync-content 覆盖 —— 绝对不要拿它当输入）。
//  2. friend.json 列表格式（FCLite domain/models.py L83-91）：
//       len<=3 -> [name, url, avatar]
//       len>3  -> [name, url, linkpage, avatar]      ← linkpage 在 avatar 之前
//     linkpage 决定反链检测跑不跑；探测不到的站点保持 3 字段（= 不检测，前端按「未知」处理）。
//  3. 已探测到的 linkpage 会被保留（不重复探测、不丢人工修正），只补新增/缺失的。
//  4. 内容没变化就不提交 —— 避免空推刷 Vercel 构建。
//
// 需要的环境变量：GH_TOKEN（写站点仓）、CONTENT_TOKEN（读内容仓，公开仓可用 GITHUB_TOKEN）

import { createRequire } from "node:module";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require_ = createRequire(import.meta.url);

const SITE = { owner: "yujing0208", repo: "yujingblog-site", path: "public/friend.json", branch: "main" };
const CONTENT = { owner: "yujing0208", repo: "yujingblog-content", path: "content/data/friends.ts", branch: "master" };

const GH_TOKEN = process.env.GH_TOKEN;
const CONTENT_TOKEN = process.env.CONTENT_TOKEN || process.env.GH_TOKEN;

const CANDIDATES = ["/links/", "/friends/", "/link/", "/links.html", "/friend/", "/pages/links/", "/links/index.html"];
const KEYWORDS = ["友链", "友情链接", "友情连接", "friends", "links", "好友", "友情鏈接"];

const say = (...a) => console.log(a.join(" "));

/** 只比较内容本身（忽略缩进/空白差异），用于判断要不要提交 */
function normalize(list) {
  return (list || []).map((r) => (Array.isArray(r) ? r.map((x) => String(x || "").trim()) : []));
}

function die(msg) {
  say("::error::" + msg);
  process.exit(1);
}

if (!GH_TOKEN) die("缺少 GH_TOKEN");
if (!CONTENT_TOKEN) die("缺少 CONTENT_TOKEN");

async function api(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: "token " + token,
      "User-Agent": "friend-json-sync",
      Accept: "application/vnd.github+json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function getRaw(token, { owner, repo, branch, path }) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const res = await fetch(url, { headers: { Authorization: "token " + token, "User-Agent": "friend-json-sync" } });
  return { status: res.status, text: await res.text() };
}

const norm = (u) => {
  const raw = String(u || "").trim();
  try {
    const url = new URL(raw);
    return (url.host.replace(/^www\./, "") + url.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").toLowerCase();
  }
};

/** 把 content/data/friends.ts 转成 JS 数组（不引入 TS 编译器） */
function parseFriendsTS(src) {
  const marker = "const friendsData: FriendItem[] = [";
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const start = i + marker.length - 1; // 指向 '['
  const end = src.indexOf("\n];", start);
  if (end < 0) return null;
  const arrayText = src.slice(start, end + 3); // "[ ... ];"
  const tmp = join(tmpdir(), "friends_data_" + Date.now() + ".cjs");
  writeFileSync(tmp, "module.exports = " + arrayText + "\n", "utf8");
  try {
    const data = require_(tmp);
    return Array.isArray(data) ? data : null;
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

async function probeLinkpage(site) {
  const base = String(site).replace(/\/+$/, "");
  for (const c of CANDIDATES) {
    const url = base + c;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, {
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) friend-json-sync" },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct && !ct.includes("html") && !ct.includes("text")) continue;
      const body = (await res.text()).slice(0, 200000).toLowerCase();
      if (!body) continue;
      if (!KEYWORDS.some((k) => body.includes(k.toLowerCase()))) continue;
      return url;
    } catch {
      // 超时 / 证书 / DNS 一律跳过
    }
  }
  return "";
}

(async () => {
  // 1) 读内容仓的友链数据
  const src = await getRaw(CONTENT_TOKEN, CONTENT);
  if (src.status !== 200) die(`读内容仓失败 status=${src.status}`);
  const friends = parseFriendsTS(src.text);
  if (!friends || !friends.length) die("解析 content/data/friends.ts 失败或为空");
  say(`content friends=${friends.length}`);

  // 2) 读现有 friend.json（拿 sha + 已探测到的 linkpage）
  const cur = await api(GH_TOKEN, "GET", `https://api.github.com/repos/${SITE.owner}/${SITE.repo}/contents/${SITE.path}?ref=${SITE.branch}`);
  let sha = null;
  const known = new Map();
  let oldText = "";
  if (cur.status === 200 && cur.json && cur.json.content) {
    sha = cur.json.sha;
    oldText = Buffer.from(cur.json.content, "base64").toString("utf8");
    try {
      for (const row of JSON.parse(oldText).friends || []) {
        if (Array.isArray(row) && row.length >= 4 && row[2]) known.set(norm(row[1]), row[2]);
      }
    } catch (e) {
      say("::warning::现有 friend.json 解析失败，将整份重建");
    }
  } else if (cur.status !== 404) {
    die(`读 ${SITE.path} 失败 status=${cur.status}`);
  }
  say(`existing linkpages=${known.size}`);

  // 3) 组装新数据（只对缺失 linkpage 的站点探测）
  const out = [];
  let reused = 0, probed = 0, missing = 0;
  for (const f of friends) {
    const title = String(f.title || "").trim();
    const site = String(f.siteurl || "").trim();
    const avatar = String(f.imgurl || "").trim();
    if (!title || !site) continue;
    const key = norm(site);
    let linkpage = known.get(key) || "";
    if (linkpage) {
      reused += 1;
    } else {
      linkpage = await probeLinkpage(site);
      if (linkpage) { probed += 1; say(`  + ${title} -> ${linkpage}`); }
      else { missing += 1; say(`  - ${title} 未探测到友链页`); }
    }
    out.push(linkpage ? [title, site, linkpage, avatar] : [title, site, avatar]);
  }
  say(`reused=${reused} newly_probed=${probed} missing=${missing}`);

  // 4) 无变化就不提交
  const newText = JSON.stringify({ friends: out }, null, 2) + "\n";
  const normOld = JSON.stringify(normalize(JSON.parse(oldText || '{"friends":[]}').friends || []));
  const normNew = JSON.stringify(normalize(out));
  if (sha && normOld === normNew) {
    say("内容无变化，跳过提交");
    return;
  }

  // 5) 提交（409 = 期间有人推过，重取 sha 再试一次）
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const put = await api(GH_TOKEN, "PUT", `https://api.github.com/repos/${SITE.owner}/${SITE.repo}/contents/${SITE.path}`, {
      message: `chore(friend.json): auto sync ${out.length} friends from content repo`,
      content: Buffer.from(newText, "utf8").toString("base64"),
      sha: sha || undefined,
      branch: SITE.branch,
    });
    if (put.status < 300) {
      say(`committed=${put.json && put.json.commit && put.json.commit.sha}`);
      return;
    }
    if (put.status === 409 || put.status === 422) {
      say(`::warning::提交冲突(attempt ${attempt})，重取 sha`);
      const again = await api(GH_TOKEN, "GET", `https://api.github.com/repos/${SITE.owner}/${SITE.repo}/contents/${SITE.path}?ref=${SITE.branch}`);
      if (again.status === 200 && again.json) { sha = again.json.sha; continue; }
    }
    die(`提交失败 status=${put.status} ${put.text.slice(0, 300)}`);
  }
  die("提交重试后仍失败");
})();
