/**
 * Vercel Serverless Function — CF 图床服务端代理
 *
 * 目标：把图床 token 从前端彻底挪到服务端。
 * 前端：
 *   POST /api/imgbed          （body=图片二进制, X-Filename=文件名）→ { ok, url }
 *   GET  /api/imgbed?op=list  → { ok, files: [...] }
 *
 * 上游：CloudFlare-ImgBed（cfbed.sanyue.de）
 *   POST /upload            multipart 字段 file    → [{ src: "/file/xxx.png" }]
 *   GET  /api/manage/list?dir=...                   → 文件列表
 * 鉴权：Authorization: Bearer <CFBED_TOKEN>
 *
 * 环境变量：
 * - CFBED_TOKEN      必填（upload + list 权限）。未配置时返回 500 与明确错误提示。
 * - CFBED_BASE       可选，缺省 https://cfbed.sanyue.de
 *
 * 注意：CommonJS（同 api/chat.js 顶部注释原因）。
 */

const CFBED_BASE = (process.env.CFBED_BASE || "https://cfbed.sanyue.de").replace(/\/$/, "");

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    if (typeof req.body === "string") return Promise.resolve(Buffer.from(req.body, "utf8"));
  }
  if (req.readableEnded) return Promise.resolve(Buffer.alloc(0));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function authHeaders() {
  const token = process.env.CFBED_TOKEN || "";
  return { Authorization: "Bearer " + token };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const token = process.env.CFBED_TOKEN || "";
  if (!token) {
    return json(res, 500, {
      ok: false,
      error: "服务端未配置 CFBED_TOKEN（在 Vercel 项目环境变量中添加后重新部署即可）",
    });
  }

  const method = String(req.method || "GET").toUpperCase();

  try {
    if (method === "POST") {
      /* 上传：转发为 multipart/form-data */
      const buf = await readBody(req);
      if (!buf.length) return json(res, 400, { ok: false, error: "请求体为空" });

      const url = String(req.url || "");
      const qi = url.indexOf("?");
      const params = new URLSearchParams(qi >= 0 ? url.slice(qi + 1) : "");
      const fnameRaw = params.get("filename") || req.headers["x-filename"] || "image.png";
      let fname = "image.png";
      try { fname = decodeURIComponent(String(fnameRaw)); } catch (e) { fname = String(fnameRaw); }

      const form = new FormData();
      form.append("file", new Blob([buf]), fname);

      const up = await fetch(CFBED_BASE + "/upload", {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const text = await up.text();
      if (!up.ok) {
        return json(res, up.status, { ok: false, error: "图床返回 " + up.status + "：" + text.slice(0, 300) });
      }
      let j = null;
      try { j = JSON.parse(text); } catch (e) { /* 非 JSON 响应，原样返回 */ }
      let rel = "";
      if (Array.isArray(j) && j[0] && j[0].src) rel = j[0].src;
      else if (j && j.src) rel = j.src;
      else if (j && j.url) rel = j.url;
      if (!rel) return json(res, 200, { ok: false, error: "图床响应无法解析：" + text.slice(0, 300) });
      const full = rel.indexOf("http") === 0 ? rel : CFBED_BASE + rel;
      return json(res, 200, { ok: true, url: full });
    }

    if (method === "GET") {
      const url = String(req.url || "");
      const qi = url.indexOf("?");
      const params = new URLSearchParams(qi >= 0 ? url.slice(qi + 1) : "");
      if ((params.get("op") || "") !== "list") {
        return json(res, 200, { ok: true, configured: true });
      }
      const dir = params.get("dir") || "";
      const lst = await fetch(CFBED_BASE + "/api/manage/list?dir=" + encodeURIComponent(dir), {
        headers: authHeaders(),
      });
      const text = await lst.text();
      if (!lst.ok) {
        return json(res, 200, { ok: false, error: "列举失败 " + lst.status + "：" + text.slice(0, 200) });
      }
      let files = [];
      try {
        const j = JSON.parse(text);
        files = Array.isArray(j) ? j : (j.files || j.data || []);
      } catch (e) { /* 保持空 */ }
      return json(res, 200, { ok: true, files: files });
    }

    return json(res, 405, { ok: false, error: "Method Not Allowed" });
  } catch (e) {
    return json(res, 502, { ok: false, error: "图床请求失败：" + (e && e.message ? e.message : "unknown") });
  }
};
