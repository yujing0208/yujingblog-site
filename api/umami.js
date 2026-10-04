/**
 * Vercel Serverless Function — Umami 分享 API 代理
 *
 * 用途：/admin 统计页与仪表盘取浏览量数据。
 * Umami Cloud 分享 API 不允许浏览器直连（CORS / 鉴权头），由本函数在服务端代为请求。
 *
 * 调用：GET /api/umami?ep=<encodeURIComponent("/pageviews")>&startAt=...&endAt=...&unit=day
 *   ep 仅允许 /stats /pageviews /metrics /chart /events 这类网站只读端点。
 * 服务端自动解析分享 token（缓存 10 分钟），带上 x-umami-share-* 头去调 cloud.umami.is。
 *
 * 环境变量（可选，缺省用内置分享 ID）：
 * - UMAMI_SHARE_ID  分享链接里的 ID
 *
 * 注意：CommonJS（同 api/chat.js 顶部注释原因）。
 */

const API_BASE = "https://cloud.umami.is/analytics/us/api";
const SHARE_ID = process.env.UMAMI_SHARE_ID || "eq6I2iWnakVCH2Rt";
const ALLOWED_EP = ["/stats", "/pageviews", "/metrics", "/chart", "/events", "/sessions"];

let shareCache = null; // { token, websiteId, at }

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function resolveShare() {
  if (shareCache && Date.now() - shareCache.at < 10 * 60 * 1000) return shareCache;
  const r = await fetch(API_BASE + "/share/" + SHARE_ID);
  if (!r.ok) throw new Error("Umami share 解析失败 " + r.status);
  const j = await r.json();
  if (!j || !j.token || !j.websiteId) throw new Error("Umami share 响应缺少 token/websiteId");
  shareCache = { token: j.token, websiteId: j.websiteId, at: Date.now() };
  return shareCache;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    return json(res, 405, { error: "Method Not Allowed" });
  }

  const url = String(req.url || "");
  const qi = url.indexOf("?");
  const search = qi >= 0 ? url.slice(qi + 1) : "";
  const params = new URLSearchParams(search);

  const epRaw = params.get("ep") || "/stats";
  let ep = epRaw;
  try { ep = decodeURIComponent(epRaw); } catch (e) { /* 保留原样 */ }
  if (ALLOWED_EP.indexOf(ep) === -1) {
    return json(res, 403, { error: "端点不在允许范围：" + ep });
  }
  params.delete("ep");

  try {
    const share = await resolveShare();
    const qs = params.toString();
    const u = API_BASE + "/websites/" + share.websiteId + ep + (qs ? "?" + qs : "");
    const up = await fetch(u, {
      headers: {
        "x-umami-share-context": "1",
        "x-umami-share-token": share.token,
        Accept: "application/json",
      },
    });
    const text = await up.text();
    res.statusCode = up.status;
    res.setHeader("Content-Type", up.headers.get("content-type") || "application/json; charset=utf-8");
    res.end(text);
  } catch (e) {
    return json(res, 502, { error: "Umami 请求失败：" + (e && e.message ? e.message : "unknown") });
  }
};
