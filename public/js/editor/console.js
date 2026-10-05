/**
 * YuJing 记忆终端 · /admin 控制台
 * 按 preview/editor-preview.html（2026-10-04 视觉签收版）1:1 重写。
 * 数据层复用 /js/editor 既有引擎（EditorGit / EditorTsIO / EditorMd / schema）。
 * 表单不再使用旧 EditorForm（ef-* 皮肤），全部用预览稿的 form-grid 皮肤。
 */
(function () {
	"use strict";

	/* 引擎别名（/js/editor 既有全局） */
	var GIT = window.EditorGit, TSIO = window.EditorTsIO, MDM = window.EditorMd;

	/* ================= 小工具 ================= */
	function $(sel, root) { return (root || document).querySelector(sel); }
	function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
	function el(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}
	function esc(s) {
		return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}
	function pad(n) { return String(n).padStart(2, "0"); }
	function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
	function nowISO() { var d = new Date(); return today() + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":00+08:00"; }
	function fmtBytes(b) {
		if (b == null) return "—";
		if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB";
		if (b >= 1024) return (b / 1024).toFixed(0) + " KB";
		return b + " B";
	}
	function timeAgo(ts) {
		var s = (Date.now() - ts) / 1000;
		if (s < 60) return "刚刚";
		if (s < 3600) return Math.floor(s / 60) + " 分钟前";
		if (s < 86400) return Math.floor(s / 3600) + " 小时前";
		if (s < 2592000) return Math.floor(s / 86400) + " 天前";
		return Math.floor(s / 2592000) + " 个月前";
	}
	var __toastTm = null;
	function toast(msg) {
		var t = document.getElementById("__actToast");
		if (!t) {
			t = el("div", "up-toast");
			t.id = "__actToast";
			t.innerHTML = '<div class="up-t"><span data-msg></span></div>';
			document.body.appendChild(t);
		}
		t.querySelector("[data-msg]").textContent = msg;
		t.classList.add("on");
		clearTimeout(__toastTm);
		__toastTm = setTimeout(function () { t.classList.remove("on"); }, 2400);
	}

	/* ================= 复制 / 图片预览灯箱（编辑器全局共用） ================= */
	function legacyCopy(txt) {
		try {
			var ta = document.createElement("textarea");
			ta.value = txt;
			ta.setAttribute("readonly", "");
			ta.style.position = "fixed";
			ta.style.left = "-9999px";
			document.body.appendChild(ta);
			ta.select();
			var ok = document.execCommand("copy");
			document.body.removeChild(ta);
			return ok;
		} catch (e) { return false; }
	}
	function copyText(txt) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			return navigator.clipboard.writeText(txt)
				.then(function () { return true; })
				.catch(function () { return legacyCopy(txt); });
		}
		return Promise.resolve(legacyCopy(txt));
	}
	/** 看起来像图片地址（外链 http(s) 或站内 /images/ 静态路径） */
	function isImgSrc(s) {
		var t = String(s == null ? "" : s).trim();
		if (!t) return false;
		if (/^https?:\/\//i.test(t)) return true;
		return /^\/images\//.test(t) || /^\/pio\//.test(t);
	}
	/**
	 * 打开大图预览灯箱：object-fit:contain ⇒ 完整图片（不是裁切的一角）。
	 * 底部带 复制 Markdown / HTML / 直链 + 新窗口打开。
	 */
	function openImagePreview(src, name) {
		if (!src) return;
		var box = document.getElementById("__imgLbx");
		if (!box) {
			box = el("div", "lbx");
			box.id = "__imgLbx";
			box.innerHTML =
				'<div class="lbx-veil" data-lbx-close></div>' +
				'<figure class="lbx-fig"><img class="lbx-img" alt="" data-lbx-img>' +
				'<figcaption class="lbx-cap"><span class="lbx-nm" data-lbx-name></span>' +
				'<span class="lbx-ops">' +
				'<button class="btn btn-sm" type="button" data-lbx-copy="md">复制 Markdown</button>' +
				'<button class="btn btn-sm" type="button" data-lbx-copy="html">复制 HTML</button>' +
				'<button class="btn btn-sm" type="button" data-lbx-copy="url">复制直链</button>' +
				'<a class="btn btn-sm" data-lbx-open target="_blank" rel="noopener">新窗口打开</a>' +
				'<button class="btn btn-sm" type="button" data-lbx-close>关闭</button>' +
				"</span></figcaption></figure>";
			document.body.appendChild(box);
			box.addEventListener("click", function (e) {
				if (e.target.closest("[data-lbx-close]")) { box.classList.remove("on"); return; }
				var cp = e.target.closest("[data-lbx-copy]");
				if (!cp) return;
				var u = box.getAttribute("data-src") || "";
				var kind = cp.getAttribute("data-lbx-copy");
				var txt = kind === "md" ? "![](" + u + ")" : kind === "html" ? '<img src="' + u + '">' : u;
				copyText(txt).then(function (ok) { toast(ok ? "已复制" : "复制失败，请手动选择"); });
			});
			document.addEventListener("keydown", function (e) {
				if (e.key === "Escape" && box.classList.contains("on")) box.classList.remove("on");
			});
		}
		box.setAttribute("data-src", src);
		box.querySelector("[data-lbx-img]").setAttribute("src", src);
		box.querySelector("[data-lbx-name]").textContent = name || String(src).split("/").pop() || "";
		box.querySelector("[data-lbx-open]").setAttribute("href", src);
		box.classList.add("on");
	}
	/** 表单 image 字段下方的缩略预览 */
	function setImgPrev(box, url) {
		if (!box) return;
		if (isImgSrc(url)) {
			box.classList.add("on");
			box.innerHTML = '<img src="' + esc(String(url).trim()) + '" alt="" loading="lazy">';
		} else {
			box.classList.remove("on");
			box.innerHTML = "";
		}
	}

	/* ================= 全局拖拽：图片 → 图床 → 插入外链 ================= */
	var LAST_TA = null;
	function isImageFile(f) {
		if (!f) return false;
		if (/^image\//i.test(f.type || "")) return true;
		return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(f.name || "");
	}
	function isMdFile(f) {
		if (!f) return false;
		if (/\.(md|markdown|mdx|txt)$/i.test(f.name || "")) return true;
		return f.type === "text/markdown";
	}
	function readTextFile(file) {
		return new Promise(function (res, rej) {
			var r = new FileReader();
			r.onload = function () { res(String(r.result || "")); };
			r.onerror = function () { rej(new Error("读取失败")); };
			r.readAsText(file, "utf-8");
		});
	}
	/** 在光标处插入文本（并广播 input 事件，触发表单绑定） */
	function insertAtCursor(ta, text) {
		if (!ta) return false;
		var s = ta.selectionStart, e2 = ta.selectionEnd;
		if (typeof s !== "number" || typeof e2 !== "number") { s = e2 = ta.value.length; }
		var before = ta.value.slice(0, s), after = ta.value.slice(e2);
		var pre = (before && !/\n$/.test(before)) ? "\n" : "";
		var suf = (after && !/^\n/.test(after)) ? "\n" : "";
		ta.value = before + pre + text + suf + after;
		var pos = (before + pre + text + suf).length;
		try { ta.setSelectionRange(pos, pos); ta.focus(); } catch (e) { /* 忽略 */ }
		ta.dispatchEvent(new Event("input", { bubbles: true }));
		DIRTY = true;
		return true;
	}
	/** 把 URL 写进 input[data-fk]（含 image 字段预览刷新） */
	function setFieldValue(inp, v) {
		if (!inp) return;
		inp.value = v;
		var f = inp.closest ? inp.closest(".f") : null;
		if (f) setImgPrev(f.querySelector(".imgprev"), v);
		inp.dispatchEvent(new Event("input", { bubbles: true }));
		DIRTY = true;
	}
	/** 往 .tags 容器里追加一枚标签（走它自己的回车逻辑，保证同步归档） */
	function addTagChip(box, val) {
		var inp = box && box.querySelector("input");
		if (!inp) return;
		inp.value = val;
		try {
			inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
		} catch (e) { /* 极端环境忽略 */ }
	}
	function ensureDragVeil() {
		var v = document.getElementById("__dragVeil");
		if (!v) {
			v = el("div", "drag-veil");
			v.id = "__dragVeil";
			v.innerHTML = '<div class="drag-veil-in"><b>松开即可上传到图床</b>' +
				'<span>拖到「正文文本框」→ 在光标处插入 ![](外链)；拖到「图片字段 / 标签框」→ 直接填进去；' +
				'拖到页面空白处 → 上传后把 Markdown 复制到剪贴板。</span>' +
				'<span>.md / .markdown 文件：在「笔记本」页=批量导入校园杂记，其他页=新建文章草稿。</span></div>';
			document.body.appendChild(v);
		}
		return v;
	}
	function hasFiles(e) {
		var dt = e.dataTransfer;
		if (!dt || !dt.types) return false;
		return Array.prototype.some.call(dt.types, function (t) { return t === "Files"; });
	}
	/**
	 * 图片落点判定（优先级）：正文 textarea > input[data-fk] > .tags 标签框 > 最后聚焦过的 textarea > 剪贴板
	 */
	function handleImageDrop(files, target) {
		var t = target && target.closest ? target : null;
		/* 相册面板的专属落区：本地模式 → 图片直接进相册；外链模式 → 传图床并追加外链 */
		var alZone = t ? t.closest("[data-al-drop]") : null;
		if (alZone && AL_STATE && AL_STATE.d) {
			if (AL_STATE.mode === "external") {
				toast("正在上传 " + files.length + " 张到图床…");
				var got = [], k = 0;
				var put = function () {
					if (k >= files.length) {
						var tabs = document.getElementById("alPhotosText");
						if (tabs && got.length) {
							var cur = tabs.value.replace(/\s+$/, "");
							tabs.value = (cur ? cur + "\n" : "") + got.join("\n") + "\n";
						}
						toast(got.length ? "已追加 " + got.length + " 条外链，记得点「保存到暂存区」" : "上传失败");
						return;
					}
					uploadToImgbed(files[k++]).then(function (r) { return r.json(); })
						.then(function (j) { if (j && j.url) got.push(j.url); })
						.catch(function () { }).then(put);
				};
				put();
				return;
			}
			uploadAlbumPhotos(files);
			return;
		}
		var ta = t && t.closest("textarea");
		var fld = t && t.closest("input[data-fk]");
		var tags = t && t.closest(".tags[data-fk]");
		if (!fld) {
			var wrap = t && t.closest(".inp-inline");
			if (wrap) fld = wrap.querySelector("input[data-fk]");
		}
		if (!ta && !fld && !tags) ta = LAST_TA;
		toast("正在上传 " + files.length + " 张到图床…");
		var urls = [], fail = 0, i = 0;
		function step() {
			if (i >= files.length) return finish();
			var f = files[i++];
			uploadToImgbed(f).then(function (r) { return r.json(); }).then(function (j) {
				if (j && j.url) urls.push(j.url); else fail++;
			}).catch(function () { fail++; }).then(step);
		}
		function finish() {
			if (!urls.length) { toast("上传失败" + (fail ? "（" + fail + " 张）" : "")); return; }
			if (ta) {
				insertAtCursor(ta, urls.map(function (u) { return "![](" + u + ")"; }).join("\n"));
				toast("已插入 " + urls.length + " 张图片外链" + (fail ? "（失败 " + fail + "）" : ""));
			} else if (fld) {
				setFieldValue(fld, urls[0]);
				toast("已填入图片地址" + (urls.length > 1 ? "（取第 1 张）" : ""));
			} else if (tags) {
				urls.forEach(function (u) { addTagChip(tags, u); });
				toast("已加入 " + urls.length + " 张图片" + (fail ? "（失败 " + fail + "）" : ""));
			} else {
				var md = urls.map(function (u) { return "![](" + u + ")"; }).join("\n");
				copyText(md).then(function (ok) {
					toast(ok ? "已上传，Markdown 已复制到剪贴板" : "已上传：" + urls[0]);
				});
			}
		}
		step();
	}
	function handleMdDropFiles(files, target) {
		var onNb = (target && target.closest && target.closest("[data-nb-drop]")) || current === "notebooks";
		if (onNb) { importNotebookMd(files); return; }
		var f = files[0];
		readTextFile(f).then(function (txt) { newPostFromText(txt, f.name, null); })
			.catch(function (e) { toast("读取失败：" + e.message); });
	}
	function initGlobalDnd() {
		var depth = 0;
		document.addEventListener("focusin", function (e) {
			if (e.target && e.target.tagName === "TEXTAREA") LAST_TA = e.target;
		});
		document.addEventListener("dragenter", function (e) {
			if (!hasFiles(e)) return;
			depth++;
			ensureDragVeil().classList.add("on");
		});
		document.addEventListener("dragover", function (e) {
			if (!hasFiles(e)) return;
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
		});
		document.addEventListener("dragleave", function (e) {
			if (!hasFiles(e)) return;
			depth = Math.max(0, depth - 1);
			if (depth === 0) ensureDragVeil().classList.remove("on");
		});
		document.addEventListener("dragend", function () {
			depth = 0;
			ensureDragVeil().classList.remove("on");
		});
		document.addEventListener("drop", function (e) {
			if (!hasFiles(e)) return;
			e.preventDefault();
			depth = 0;
			ensureDragVeil().classList.remove("on");
			var all = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
			if (!all.length) return;
			var imgs = all.filter(isImageFile);
			var mds = all.filter(isMdFile);
			if (imgs.length) handleImageDrop(imgs, e.target);
			if (mds.length) handleMdDropFiles(mds, e.target);
		});
	}
	/** 全局：点图片 → 大图预览；点「值就是图片地址」的标签 → 同样预览 */
	function initImagePreviewClicks() {
		document.addEventListener("click", function (e) {
			var pv = e.target.closest ? e.target.closest("[data-imgprev]") : null;
			if (pv) {
				e.preventDefault();
				openImagePreview(pv.getAttribute("data-imgprev"), pv.getAttribute("data-name") || "");
				return;
			}
			var img = e.target.closest ? e.target.closest("img") : null;
			if (img && img.closest(".views") && !img.hasAttribute("data-noprev") && !img.closest(".cmt-avatar")) {
				var src = img.getAttribute("src");
				if (isImgSrc(src)) { openImagePreview(src, img.getAttribute("alt") || ""); }
				return;
			}
			var chip = e.target.closest ? e.target.closest(".tags .tag") : null;
			if (chip) {
				var val = chip.textContent.replace(/×$/, "").trim();
				if (isImgSrc(val)) openImagePreview(val, "");
			}
		});
	}

	/* ================= 主题跟随（读博客 localStorage） ================= */
	var BLOG_ACCENTS = ["green", "blue", "purple", "sakura", "pink", "orange", "black"];
	function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
	function applyBlogLook() {
		var accent = lsGet("paper-accent");
		if (BLOG_ACCENTS.indexOf(accent) < 0) accent = "green";
		document.documentElement.setAttribute("data-accent", accent);
		if (lsGet("theme") === "dark") document.documentElement.classList.add("dark");
		else document.documentElement.classList.remove("dark");
	}
	if (!lsGet("theme")) {
		try { if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.classList.add("dark"); } catch (e) {}
	}
	window.addEventListener("storage", function (e) {
		if (e.key === "paper-accent" || e.key === "theme") applyBlogLook();
	});

	/* ================= 数据层 ================= */
	var OWNER = "yujing0208", REPO = "yujingblog-content", BRANCH = "master";
	var SITE_REPO = "yujingblog-site", SITE_BRANCH = "main";
	var TWIKOO_URL = "https://twikoo.yujingblog.top";
	var MONTH_START = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
	var CACHE = {};
	function withTimeout(p, ms) {
		return new Promise(function (res) {
			var done = false;
			var t = setTimeout(function () { if (!done) { done = true; res(null); } }, ms || 8000);
			p.then(function (v) { if (!done) { done = true; clearTimeout(t); res(v); } })
				.catch(function () { if (!done) { done = true; clearTimeout(t); res(null); } });
		});
	}
	function gh(path, opts) {
		opts = opts || {};
		return fetch("/api/editor-github?path=" + encodeURIComponent(path), {
			method: opts.method || "GET",
			headers: opts.body ? { "Content-Type": "application/json" } : undefined,
			body: opts.body,
			credentials: "same-origin",
		}).then(function (r) {
			if (r.status === 401 && window.EditorAuthGate && window.EditorAuthGate.require) window.EditorAuthGate.require();
			return r.json().then(function (j) {
				if (!r.ok) throw new Error((j && j.message) || ("GitHub 请求失败 " + r.status));
				return j;
			});
		});
	}
	function ghCommits(repo, n, branch) {
		return gh("/repos/" + OWNER + "/" + repo + "/commits?sha=" + (branch || (repo === REPO ? BRANCH : SITE_BRANCH)) + "&per_page=" + (n || 5));
	}
	function ghTree(repo, branch) {
		return gh("/repos/" + OWNER + "/" + repo + "/git/trees/" + (branch || (repo === REPO ? BRANCH : SITE_BRANCH)) + "?recursive=1");
	}
	function twikoo(event, data) {
		return fetch(TWIKOO_URL, {
			method: "POST", headers: { "Content-Type": "application/json" },
			body: JSON.stringify(Object.assign({ event: event }, data || {}, { envId: TWIKOO_URL })),
		}).then(function (r) { return r.json(); });
	}
	function twikooRecent() {
		if (CACHE.comments) return Promise.resolve(CACHE.comments);
		return twikoo("GET_RECENT_COMMENTS", { pageSize: 500, includeReply: true }).then(function (r) {
			var list = (r.data || []).slice().sort(function (a, b) { return b.created - a.created; });
			CACHE.comments = list;
			return list;
		});
	}
	function umami(ep, qs) {
		var u = "/api/umami?ep=" + encodeURIComponent(ep) + (qs ? "&" + qs : "");
		return fetch(u, { credentials: "same-origin" }).then(function (r) {
			return r.json().then(function (j) {
				if (!r.ok) throw new Error((j && j.error) || ("Umami " + r.status));
				return j;
			});
		});
	}
	function getTs(schema) {
		/* 同一个 ts 文件里可能有多个数据源（如 notebooks.ts 的 campusNotebook /
		   runNotebook / dailyNotebook）：按 path 缓存原始文本，按 path+varName 缓存
		   解析结果。否则先取的那本会把后取的顶掉（value 变成上一本的数组）。 */
		var rawKey = "ts:raw:" + schema.path;
		var k = "ts:val:" + schema.path + "#" + (schema.varName || "");
		if (CACHE[k]) return Promise.resolve(CACHE[k]);
		var load = CACHE[rawKey] ? Promise.resolve(CACHE[rawKey])
			: GIT.getFile(schema.owner, schema.repo, schema.path, schema.branch).then(function (f) {
				if (!f) throw new Error("文件不存在：" + schema.path);
				CACHE[rawKey] = { raw: f.content, sha: f.sha };
				return CACHE[rawKey];
			});
		return load.then(function (o) {
			var v = TSIO.extract(o.raw, schema.varName);
			if (v === null) throw new Error("无法解析 " + schema.path + " 的数据段（" + schema.varName + "）");
			CACHE[k] = { raw: o.raw, sha: o.sha, value: v };
			return CACHE[k];
		});
	}
	function clearTs(schema) {
		var rk = "ts:raw:" + schema.path, vp = "ts:val:" + schema.path + "#";
		Object.keys(CACHE).forEach(function (k) { if (k === rk || k.indexOf(vp) === 0) delete CACHE[k]; });
	}

	/* 文章元数据（递归收集 + 解析 frontmatter） */
	function listPosts() {
		function collect(dirPath) {
			return GIT.listDir(OWNER, REPO, dirPath, BRANCH).then(function (entries) {
				var files = [], dirs = [];
				entries.forEach(function (e) {
					if (e.type === "dir") dirs.push(e);
					else if (e.type === "file" && /\.md$/.test(e.name)) files.push(e);
				});
				return Promise.all(dirs.map(function (d) { return collect(d.path).then(function (sub) { files.push.apply(files, sub); }); }))
					.then(function () { return files; });
			});
		}
		return collect("content/posts");
	}
function loadPostsWithMeta() {
	if (CACHE.posts) return Promise.resolve(CACHE.posts);
	// 先试 localStorage 缓存（5 分钟 TTL），避免每次打开编辑器都全量拉文章全文
	try {
		var cached = localStorage.getItem('editor.postsCache');
		if (cached) {
			var ts = Number(localStorage.getItem('editor.postsCacheTs') || 0);
			if (Date.now() - ts < 300000) {
				CACHE.posts = JSON.parse(cached);
				return Promise.resolve(CACHE.posts);
			}
		}
	} catch (e) {}
	return listPosts().then(function (files) {
		var out = [], idx = 0;
		function worker() {
			if (idx >= files.length) return Promise.resolve();
			var f = files[idx++];
			return GIT.getFile(OWNER, REPO, f.path, BRANCH).then(function (r) {
				if (r) {
					var p = MDM.parse(r.content);
					out.push({ file: f, sha: r.sha, fm: p.data || {}, body: p.body || "", raw: r.content });
				}
				return worker();
			});
		}
		return Promise.all([worker(), worker(), worker(), worker(), worker()]).then(function () {
			out.sort(function (a, b) {
				var ka = a.file.path, kb = b.file.path;
				return String(b.fm.published || "").localeCompare(String(a.fm.published || "")) || kb.localeCompare(ka);
			});
			CACHE.posts = out;
			// 缓存到 localStorage，TTL 5 分钟
			try {
				localStorage.setItem('editor.postsCache', JSON.stringify(out));
				localStorage.setItem('editor.postsCacheTs', String(Date.now()));
			} catch (e) {}
			return out;
		});
	});
}
	function countByPrefix(list, prefix) {
		var n = 0; list.forEach(function (p) { if (p.file.path.indexOf(prefix) === 0) n++; }); return n;
	}

	/* ================= 登录闸门（预览稿同款 .login 页） ================= */
	function authCheck() {
		return fetch("/api/editor-auth", { method: "GET", credentials: "same-origin", cache: "no-store" })
			.then(function (r) { return r.ok ? r.json() : { ok: false }; })
			.then(function (j) { return !!(j && j.ok); })
			.catch(function () { return false; });
	}
	function authLogin(password) {
		return fetch("/api/editor-auth", {
			method: "POST", credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: password }),
		}).then(function (r) {
			return r.json().catch(function () { return {}; }).then(function (j) {
				if (!r.ok || !j || !j.ok) return { ok: false, error: (j && j.error) || "密码错误" };
				return { ok: true };
			});
		}).catch(function () { return { ok: false, error: "网络异常，请稍后重试" }; });
	}
	function authLogout() {
		return fetch("/api/editor-auth", { method: "DELETE", credentials: "same-origin" }).catch(function () { });
	}
function showLogin() {
	var l = $("#login"); if (!l) return;
	l.style.display = "";
	var pw = $("#pw"), err = $("#loginErr"), btn = $("#loginBtn"), busy = false;
	if (!pw || pw.dataset.bound) return;
	pw.dataset.bound = "1";
	function submit() {
		if (busy) return;
		var v = pw.value;
		if (!v) { err.textContent = "请输入密码"; err.style.display = "block"; return; }
		busy = true;
		btn.disabled = true; btn.textContent = "验证中…"; err.style.display = "none";
		authLogin(v).then(function (res) {
			if (res.ok) { location.reload(); return; }
			busy = false;
			btn.disabled = false; btn.textContent = "进入编辑器";
			err.textContent = res.error || "密码错误";
			err.style.display = "block";
			pw.select();
		});
	}
	btn.addEventListener("click", submit);
	pw.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
	setTimeout(function () { pw.focus(); }, 60);
}
window.addEventListener("error", function(e) {
	var el = document.getElementById("__errBanner");
	if (!el) {
		el = document.createElement("div");
		el.id = "__errBanner";
		el.style.cssText = "position:fixed;top:0;left:0;right:0;padding:8px 14px;background:#e00;color:#fff;font-size:13px;z-index:9999;white-space:pre-wrap;word-break:break-all";
		document.body.appendChild(el);
	}
	el.textContent += "JS Error: " + e.message + " @ " + e.filename + ":" + e.lineno + "\n";
});
window.EditorAuthGate = {
		check: authCheck,
		login: function (pw) { return authLogin(pw); },
		logout: authLogout,
		require: showLogin,
		start: function () { authCheck().then(function (ok) { if (!ok) showLogin(); }); },
	};

	/* ================= 图床上传（服务端代理，前端零 token） ================= */
	function uploadToImgbed(file) {
		return file.arrayBuffer ? file.arrayBuffer().then(function (buf) {
			return fetch("/api/imgbed", {
				method: "POST",
				headers: { "Content-Type": file.type || "application/octet-stream", "X-Filename": encodeURIComponent(file.name) },
				body: buf,
			});
		}) : Promise.reject(new Error("浏览器不支持 File API"));
	}
	function bindImgUpload(btn, input) {
		if (!btn || btn.dataset.imgbound) return;
		btn.dataset.imgbound = "1";
		btn.addEventListener("click", function () {
			var inp = document.createElement("input");
			inp.type = "file"; inp.accept = "image/*";
			inp.onchange = function () {
				var f = inp.files[0]; if (!f) return;
				var old = btn.textContent;
				btn.disabled = true; btn.textContent = "上传中…";
				uploadToImgbed(f).then(function (r) { return r.json(); }).then(function (j) {
					if (j && j.url) { setFieldValue(input, j.url); toast("图床上传成功"); }
					else throw new Error((j && j.error) || "上传失败");
				}).catch(function (e) { toast("上传失败：" + e.message); })
					.finally(function () { btn.disabled = false; btn.textContent = old; });
			};
			inp.click();
		});
	}

	/* ================= 暂存 / 推送 ================= */
	var STAGED = {};
	var DIRTY = false;
	function stagePut(path, content, label) {
		STAGED[path] = { path: path, content: content, label: label || path, del: false, tm: pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()) };
		syncStageUI(); renderStageList();
		toast("已暂存：" + path.split("/").pop() + "（待推送）");
	}
	/**
	 * 暂存一个「二进制」文件（相册图片等）：内容是 base64。
	 * pushAll 会带着 base64 走 Git Data API 建 blob，无需落地为文本。
	 */
	function stagePutBinary(path, base64, label) {
		STAGED[path] = { path: path, base64: base64, label: label || path, del: false, tm: pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()) };
		syncStageUI(); renderStageList();
		toast("已暂存图片：" + path.split("/").pop() + "（待推送）");
	}
	function stageDelete(path, label) {
		STAGED[path] = { path: path, content: null, label: label || path, del: true, tm: pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()) };
		syncStageUI(); renderStageList();
		toast("已暂存删除：" + path.split("/").pop() + "（待推送）");
	}
	function unstage(path) { delete STAGED[path]; syncStageUI(); renderStageList(); }
	function syncStageUI() {
		var n = Object.keys(STAGED).length;
		var btn = $("#pushBtn"), st = $("#status");
		if (btn) { btn.style.display = n > 0 ? "" : "none"; btn.textContent = "统一推送 (" + n + ")"; }
		if (st) {
			st.style.display = n > 0 ? "" : "none";
			st.className = "status s-staged";
			$("#statusText").textContent = "已暂存 " + n + " 项";
		}
	}
	function renderStageList() {
		var box = $("#spList"); if (!box) return;
		box.innerHTML = "";
		var keys = Object.keys(STAGED);
		if (!keys.length) { box.innerHTML = '<div class="empty-block">暂存区是空的。编辑内容后点「💾 存入暂存区」，可跨页面攒多次改动，一次推送。</div>'; return; }
		keys.forEach(function (k) {
			var it = STAGED[k];
			var row = el("div", "sp-item");
			row.innerHTML = '<span class="sp-tp">' + (it.del ? "删除" : (it.base64 ? "图片" : "写入")) + "</span>" +
				'<span class="sp-nm" title="' + esc(k) + '">' + esc(k) + "</span>" +
				'<span class="sp-tm num">' + (it.tm || "") + "</span>";
			var rm = el("button", "btn btn-sm", "撤销");
			rm.addEventListener("click", function () { unstage(k); });
			row.appendChild(rm);
			box.appendChild(row);
		});
	}
	function openStage(on) {
		$("#stagePanel").classList.toggle("on", on);
		$("#stageMask").classList.toggle("on", on);
	}

	function shortSha(s) { return s ? String(s).slice(0, 7) : ""; }
	function pushAll() {
		var keys = Object.keys(STAGED);
		if (!keys.length) { openStage(false); return; }
		var changes = keys.map(function (k) {
			var it = STAGED[k];
			if (it.del) return { path: k, delete: true };
			/* 二进制（相册图片）：直接给 base64，Git Data API 建 blob */
			if (it.base64) return { path: k, base64: it.base64 };
			return { path: k, content: it.content };
		});
		var btn = $("#spPush");
		if (btn) { btn.disabled = true; btn.textContent = "推送中…"; }
		GIT.commitTree(OWNER, REPO, BRANCH, changes, "chore(editor): 批量更新 " + keys.length + " 项")
			.then(function (r) {
				STAGED = {}; syncStageUI(); renderStageList(); openStage(false);
				CACHE.posts = null;
				Object.keys(CACHE).forEach(function (k) { if (k.indexOf("ts:") === 0) delete CACHE[k]; });
				try { localStorage.removeItem('editor.postsCache'); localStorage.removeItem('editor.postsCacheTs'); } catch (e) {}
				// 内容已落到内容仓库；内容仓 webhook 会通知站点仓重新构建，这里推完就结束
				return { pushed: true, sha: r.sha };
			})
			.then(function (info) {
				if (!info || info.error) { toast("推送失败：" + ((info && info.error) || "未知")); return; }
				toast("推送成功（" + shortSha(info.sha) + "），内容将在 30 秒内自动上线");
				if (current === "dash") renderDash();
				else loadView(current, true);
			})
			.catch(function (e) { toast("推送失败：" + e.message); })
			.finally(function () { if (btn) { btn.disabled = false; btn.textContent = "🚀 一键推送"; } });
	}


	/* ================= 侧栏菜单（照预览稿 NAV 树） ================= */
	var ICONS = {
		dash: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>',
		post: '<path d="M4 4h11l5 5v11H4z"/><path d="M15 4v5h5"/><path d="M8.5 13h7M8.5 16.5h4.5"/>',
		diary: '<path d="M5 4h14v16H5z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
		friend: '<path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 11l2 2 3-3"/>',
		project: '<path d="M3 7h6l2 2h10v10H3z"/>',
		about: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
		comment: '<path d="M12 3c5 0 9 3.4 9 7.8 0 4.4-4 8.2-9 8.2-1.2 0-2.3-.2-3.3-.5L4 20l1.5-3.6C4.1 15.2 3 13.2 3 10.8 3 6.4 7 3 12 3z"/>',
		album: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/>',
		note: '<path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5"/><path d="M9 13h6M9 17h4"/>',
		globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.7 2.9 2.7 15.1 0 18"/><path d="M12 3c-2.7 2.9-2.7 15.1 0 18"/>',
		device: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/>',
		anime: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M11 9.2l3.6 2.3-3.6 2.3z"/><path d="M8 21h8"/>',
		pin: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
		timeline: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
		sys: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11.5 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.2 1z"/>',
		up: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/><path d="M5 19h14"/>',
		cloudimg: '<path d="M7 18h10.2A3.8 3.8 0 0 0 17.6 10.5 6 6 0 0 0 6.1 11 3.5 3.5 0 0 0 7 18z"/><path d="M12 15.4V9.6"/><path d="M9.7 11.9L12 9.6l2.3 2.3"/>',
		chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
		db: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'
	};
	function svg(p, cls) {
		return '<svg class="' + (cls || "ic") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
	}
	var NAV = [
		{ id: "dash", label: "仪表盘", icon: "dash" },
		{ group: "内容", items: [
			{ id: "posts", label: "文章管理", icon: "post", star: true },
			{ id: "diary", label: "动态管理", icon: "diary" },
			{ id: "friends", label: "友链管理", icon: "friend" },
			{ id: "projects", label: "项目管理", icon: "project" },
			{ id: "about", label: "关于页面", icon: "about" },
			{ id: "albums", label: "相册管理", icon: "album", star: true },
			{ id: "notebooks", label: "笔记本", icon: "note", star: true }
		]},
		{ group: "其余数据", id: "more-data", items: [
			{ id: "website", label: "网站导航", icon: "globe" },
			{ id: "devices", label: "设备", icon: "device" },
			{ id: "anime", label: "追番", icon: "anime" },
			{ id: "footprints", label: "足迹", icon: "pin" },
			{ id: "timeline", label: "时间线", icon: "timeline" }
		]},
		{ group: "站点与外观", id: "more-settings", items: [
			{ id: "settings", label: "站点与外观", icon: "sys" }
		]},
		{ group: "系统", id: "more-system", items: [
			{ id: "release", label: "发布状态", icon: "up" },
			{ id: "cfbed", label: "CF 图床", icon: "cloudimg" },
			{ id: "comments", label: "全部评论", icon: "comment" },
			{ id: "stats", label: "网站统计", icon: "chart" },
			{ id: "backup", label: "数据备份", icon: "db" }
		]}
	];
	var TITLES = {
		dash: ["仪表盘", "聚合概览"], posts: ["文章管理", "Markdown 源码 + 实时预览"],
		diary: ["动态管理", "content/data/diary.ts"], friends: ["友链管理", "content/data/friends.ts"],
		projects: ["项目管理", "content/data/projects.ts"], about: ["关于页面", "content/spec/about.md"],
		albums: ["相册管理", "content/images/albums/"], notebooks: ["笔记本", "content/data/notebooks.ts"],
		website: ["网站导航", "content/data/website.ts"], devices: ["设备", "content/data/devices.ts"],
		anime: ["追番", "content/data/anime.ts"], footprints: ["足迹", "content/data/footprints.ts"],
		timeline: ["时间线", "content/data/timeline.ts"], settings: ["站点与外观", "content/settings/ 9 个文件"],
		release: ["发布状态", "GitHub commit status"], cfbed: ["CF 图床", "cfbed 目录树"],
		comments: ["全部评论", "Twikoo 全站评论"],
		stats: ["网站统计", "Umami 分享 API + Twikoo"], backup: ["数据备份", "commits / tags"]
	};
	var NAV_OPEN = {};
	try { NAV_OPEN = JSON.parse(sessionStorage.getItem("navOpen") || "{}") || {}; } catch (e) { NAV_OPEN = {}; }
	function navSave() { try { sessionStorage.setItem("navOpen", JSON.stringify(NAV_OPEN)); } catch (e) {} }
	function navItem(it, sub) {
		return '<button class="nav-item' + (sub ? " sub" : "") + '" data-go="' + it.id + '" title="' + it.label + '">'
			+ svg(ICONS[it.icon] || ICONS.dash)
			+ '<span class="nav-text">' + it.label + '</span>'
			+ (it.star ? '<span class="nav-star" title="常用">★</span>' : "")
			+ '</button>';
	}
	function renderNav() {
		var html = "";
		NAV.forEach(function (node) {
			if (!node.group) { html += navItem(node, false); return; }
			var g = node.id || node.group;
			var open = NAV_OPEN[g] === true;
			html += '<div class="nav-group' + (open ? " open" : "") + '" data-group="' + g + '">';
			html += '<button class="nav-group-head" type="button" aria-expanded="' + open + '">'
				+ '<span class="nav-label">' + node.group + '</span>'
				+ '<svg class="nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
				+ '</button>';
			html += '<div class="nav-sub">';
			node.items.forEach(function (it) { html += navItem(it, true); });
			html += '</div></div>';
		});
		$("#nav").innerHTML = html;
	}
	function syncSideUI() {
		var collapsed = document.documentElement.getAttribute("data-side") === "collapsed";
		var btn = $("#collapseBtn");
		if (btn) {
			var sp = btn.querySelector("span");
			if (sp) sp.textContent = collapsed ? "展开菜单" : "收起菜单";
			var ic = btn.querySelector("svg");
			if (ic) ic.style.transform = collapsed ? "rotate(180deg)" : "none";
		}
	}
	var current = "dash";

	/* ================= 视图切换 ================= */
	function setView(id, html) {
		var v = $("#v-" + id);
		if (v) v.innerHTML = html;
	}
	function go(id, force) {
		var _cur = $(".view.on");
		var _preScroll = window.scrollY;
		if (DIRTY && _cur && _cur.id !== "v-" + id) {
			if (!confirm("有未保存的改动，离开将丢失。确定离开吗？\n（点「💾 存入暂存区」可先保存）")) return;
			DIRTY = false;
		}
		$$(".view").forEach(function (x) { x.classList.toggle("on", x.id === "v-" + id); });
		$$("#nav .nav-item").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-go") === id); });
		var t = TITLES[id] || ["", ""];
		$("#crumb").innerHTML = '<b>' + t[0] + '</b><span class="sep">/</span><span>' + t[1] + '</span>';
		var act = $('#nav .nav-item[data-go="' + id + '"]');
		if (act) {
			var grp = act.closest(".nav-group");
			if (grp && !grp.classList.contains("open")) {
				grp.classList.add("open");
				var gh2 = grp.querySelector(".nav-group-head");
				if (gh2) gh2.setAttribute("aria-expanded", "true");
				NAV_OPEN[grp.getAttribute("data-group")] = true; navSave();
			}
		}
		if (window.matchMedia("(max-width: 1023px)").matches) document.documentElement.removeAttribute("data-drawer");
		var __S = window.__SCROLLS = window.__SCROLLS || {};
		if (_cur) __S[_cur.id] = _preScroll;
		window.scrollTo(0, __S["v-" + id] || 0);
		current = id;
		try { history.replaceState(null, "", "#/" + id); } catch (e) { }
		syncSideUI();
		loadView(id, force);
	}
	function loadView(id, force) {
		var v = $("#v-" + id);
		if (!v) return;
		if (force) v.innerHTML = "";
		if (v.innerHTML) return;
		if (id === "dash") renderDash();
		else if (id === "posts") renderPosts();
		else if (id === "comments") renderComments();
		else if (id === "stats") renderStats();
		else if (id === "release") renderRelease();
		else if (id === "backup") renderBackup();
		else if (id === "cfbed") renderCfbed();
		else if (id === "settings") renderSettings();
		else if (id === "albums") renderAlbums();
		else if (id === "about") renderAbout();
		else if (id === "notebooks") renderNotebooks();
		else if (window.getSchema(id)) renderDataPage(id);
	}

	/* ================= 通用页面骨架 ================= */
	function pageHead(icon, title, descHtml, actionsHtml) {
		return '<div class="page-head"><div class="page-chip">' + svg(ICONS[icon] || ICONS.dash) + '</div>' +
			'<div><h1 class="page-title">' + title + '</h1><p class="page-desc">' + descHtml + '</p></div>' +
			'<div class="page-actions">' + (actionsHtml || "") + '</div></div>';
	}
	function saveBar(id) {
		return '<div style="display:flex;gap:8px;margin-top:14px">' +
			'<button class="btn btn-primary" type="button" data-save="' + id + '">💾 存入暂存区</button><div style="flex:1"></div>' +
			'<button class="btn btn-danger" type="button" data-del="' + id + '">🗑 删除</button></div>';
	}
	function bindSaveDel(opts) {
		/* opts: onSave() 回调返回 {path, content}；onDelete() 可选 */
		$$("[data-save]").forEach(function (b) {
			if (b.dataset.bound) return;
			b.dataset.bound = "1";
			b.addEventListener("click", function () {
				var r = opts.onSave();
				if (r) stagePut(r.path, r.content, r.label);
			});
		});
		$$("[data-del]").forEach(function (b) {
			if (b.dataset.bound || !opts.onDelete) return;
			b.dataset.bound = "1";
			b.addEventListener("click", function () { opts.onDelete(); });
		});
	}

	/* ================= 预览稿表单皮肤（form-grid / f / inp / tags / sw） ================= */
	/* 把 schema 字段渲染成预览稿 form-grid 标记；值变化时写回 data 对象并标记 DIRTY */
	function fLabel(label, key, req, hint) {
		return '<label class="f-label">' + label + (key ? ' <span class="f-key">' + key + '</span>' : "") + (req ? '<span class="req">*</span>' : "") + '</label>' + (hint || "");
	}
	function fieldHtml(fd, val, idp) {
		var id = (idp || "") + fd.key;
		var wide = fd.type === "text" || fd.type === "tags" || fd.type === "image" ? " wide" : "";
		var h = '<div class="f' + wide + '">';
		if (fd.hidden) return "";
		var req = fd.required ? '<span class="req">*</span>' : "";
		if (fd.type === "boolean") {
			h += '<label class="f-label">' + esc(fd.label) + '</label><label class="sw"><input type="checkbox" data-fk="' + fd.key + '"' + (val ? " checked" : "") + '><i></i></label>';
		} else if (fd.type === "select") {
			h += '<label class="f-label">' + esc(fd.label) + req + '</label><select class="inp" data-fk="' + fd.key + '">';
			(fd.options || []).forEach(function (o) {
				var v = typeof o === "string" ? o : o.value;
				var t = typeof o === "string" ? o : (o.label + (o.value ? "（" + o.value + "）" : ""));
				h += '<option value="' + esc(v) + '"' + (String(val) === String(v) || (!val && o && o.selected) ? " selected" : "") + '>' + esc(t) + '</option>';
			});
			h += '</select>';
		} else if (fd.type === "tags") {
			h += '<label class="f-label">' + esc(fd.label) + req + '</label><div class="tags" data-fk="' + fd.key + '">';
			(Array.isArray(val) ? val : []).forEach(function (t) { h += '<span class="tag">' + esc(t) + ' <b>×</b></span>'; });
			h += '<input placeholder="' + esc(fd.placeholder || "输入后回车") + '"></div>';
		} else if (fd.type === "image") {
			h += '<label class="f-label">' + esc(fd.label) + req + '</label><div class="inp-inline">' +
				'<input class="inp" data-fk="' + fd.key + '" value="' + esc(val || "") + '">' +
				'<button class="btn btn-sm btn-primary" type="button" data-imgup="' + fd.key + '">上传到图床</button></div>' +
				'<div class="imgprev' + (isImgSrc(val) ? " on" : "") + '">' +
				(isImgSrc(val) ? '<img src="' + esc(String(val).trim()) + '" alt="" loading="lazy">' : "") + '</div>';
		} else if (fd.type === "date") {
			h += '<label class="f-label">' + esc(fd.label) + req + '</label><input class="inp" type="date" data-fk="' + fd.key + '" value="' + esc(String(val || "").slice(0, 10)) + '">';
		} else if (fd.type === "datetime") {
			h += '<label class="f-label">' + esc(fd.label) + req + '</label><div class="inp-inline">' +
				'<input class="inp mono" data-fk="' + fd.key + '" value="' + esc(val || "") + '" placeholder="' + esc(fd.placeholder || "") + '">' +
				'<button class="btn btn-sm" type="button" data-now="' + fd.key + '">现在</button></div>';
		} else if (fd.type === "text") {
			h += '<label class="f-label">' + esc(fd.label) + req + '</label><textarea class="inp" data-fk="' + fd.key + '" rows="3" placeholder="' + esc(fd.placeholder || "") + '">' + esc(val || "") + '</textarea>';
		} else if (fd.type === "number") {
			h += '<label class="f-label">' + esc(fd.label) + req + '</label><input class="inp num" type="number" data-fk="' + fd.key + '" value="' + esc(val == null ? "" : val) + (fd.step ? '" step="' + fd.step : "") + '">';
		} else {
			h += '<label class="f-label">' + esc(fd.label) + req + '</label><input class="inp" data-fk="' + fd.key + '" value="' + esc(val == null ? "" : val) + '" placeholder="' + esc(fd.placeholder || "") + '">';
		}
		if (fd.hint) h += '<div class="f-hint">' + fd.hint + '</div>';
		h += '</div>';
		return h;
	}
	function renderFields(fields, data, idp) {
		var h = '<div class="form-grid">';
		fields.forEach(function (fd) { h += fieldHtml(fd, data ? data[fd.key] : undefined, idp); });
		h += '</div>';
		return h;
	}
	function bindFields(root, data, onChange) {
		$$("[data-fk]", root).forEach(function (inp) {
			if (inp.classList && inp.classList.contains("tags")) return; /* tags 容器由下方专门绑定 */
			if (inp.dataset.fbound) return;
			inp.dataset.fbound = "1";
			var k = inp.getAttribute("data-fk");
			var ev = (inp.tagName === "SELECT" || inp.type === "checkbox") ? "change" : "input";
			inp.addEventListener(ev, function () {
				var v = inp.type === "checkbox" ? inp.checked : inp.value;
				if (inp.classList.contains("num")) v = v === "" ? "" : Number(v);
				data[k] = v;
				DIRTY = true;
				/* image 字段：同步下方缩略预览（跟着输入即时刷新） */
				var fbox = inp.closest ? inp.closest(".f") : null;
				if (fbox) {
					var pv = fbox.querySelector(".imgprev");
					if (pv) setImgPrev(pv, v);
				}
				if (onChange) onChange(k, v);
			});
		});
		$$(".tags[data-fk]", root).forEach(function (box) {
			if (box.dataset.fbound) return;
			box.dataset.fbound = "1";
			var k = box.getAttribute("data-fk");
			var inp = box.querySelector("input");
			function sync() { data[k] = $$(".tag", box).map(function (t) { return t.textContent.replace(/×$/, "").trim(); }); DIRTY = true; if (onChange) onChange(k, data[k]); }
			box.addEventListener("click", function (e) {
				var b = e.target.closest(".tag b");
				if (b) { b.parentNode.remove(); sync(); }
			});
			if (inp) inp.addEventListener("keydown", function (e) {
				if (e.key === "Enter" && inp.value.trim()) {
					e.preventDefault();
					var t = el("span", "tag"); t.innerHTML = esc(inp.value.trim()) + ' <b>×</b>';
					if (isImgSrc(inp.value.trim())) t.setAttribute("data-img", "1");
					box.insertBefore(t, inp); inp.value = ""; sync();
				}
			});
		});
		/* 值本身就是图片地址的标签：标出来，点击即大图预览 */
		$$(".tags .tag", root).forEach(function (c) {
			if (isImgSrc(c.textContent.replace(/×$/, "").trim())) c.setAttribute("data-img", "1");
		});
		$$("[data-now]", root).forEach(function (b) {
			if (b.dataset.bound) return;
			b.dataset.bound = "1";
			b.addEventListener("click", function () {
				var k = b.getAttribute("data-now");
				var inp = root.querySelector('[data-fk="' + k + '"]');
				if (inp) { inp.value = nowISO(); data[k] = inp.value; DIRTY = true; }
			});
		});
		$$("[data-imgup]", root).forEach(function (b) {
			var k = b.getAttribute("data-imgup");
			var inp = root.querySelector('[data-fk="' + k + '"]');
			bindImgUpload(b, inp);
		});
	}


	/* ================= 文章管理 ================= */
	var POSTS_STATE = { sel: null, filter: "all", sort: "date", q: "", draft: null, catOpen: {} };
function postCats(posts) {
	var map = {};
	posts.forEach(function (p) {
		var c = p.fm.category || "未分类";
		if (!map[c]) map[c] = [];
		map[c].push(p);
	});
	return map;
}
var CAT_COLORS = ["#7aa585", "#6b8fc4", "#e0996b", "#a98ac4", "#c48a9a", "#4f9ea8", "#8aa88f", "#c4a36b"];
function renderPosts() {
	POSTS_STATE.sel = null;
	setView("posts",
		pageHead("post", "文章管理", '<span class="mono">content/posts/**/*.md</span> · <span id="postsCount">加载中…</span>',
			'<button class="btn" type="button" id="postUpload">⬆ 上传 .md</button><button class="btn btn-primary" type="button" id="postNew">+ 新建文章</button>') +
		'<div class="mode-banner" id="pfMode" hidden></div>' +
		'<div class="m-switch seg" data-msplit><button class="on" type="button" data-mpane="a">📋 文章列表</button><button type="button" data-mpane="b">✎ 编辑面板</button></div>' +
		'<div class="split" data-panes>' +
		'<div class="card split-list">' +
		'<div class="card-head" style="padding:10px 12px"><input class="inp" id="postsSearch" placeholder="搜索标题 / 标签…（实时过滤）" style="width:100%"></div>' +
		'<div class="list-note" id="postsNote">按分类分组</div>' +
		'<div class="toolbar" style="padding:8px 12px;border-bottom:1px solid var(--line-soft)">' +
		'<div class="seg" data-sort="list"><button class="on" type="button" data-by="date">发布时间 ↓</button><button type="button" data-by="title">标题 A–Z</button></div>' +
		'<div class="seg" data-filter="posts"><button class="on" type="button" data-f="all">全部</button><button type="button" data-f="draft">草稿</button><button type="button" data-f="pin">置顶</button></div>' +
		'</div><div class="cat-list" id="postsCatList"><div class="empty-block">加载中…</div></div></div>' +
		'<div id="postPanel"><div class="card"><div class="card-body"><div class="empty-block">从左侧选择一篇文章，或点「+ 新建文章」</div></div></div></div></div>' +
		'<div class="m-bar"><button class="btn btn-sm" type="button" data-pane-go="a">☰ 列表</button><button class="btn btn-primary btn-sm" type="button" data-msave>💾 存入暂存区</button></div>');
	var up = $("#postUpload");
	if (up) up.addEventListener("click", function () {
		var inp = document.createElement("input");
		inp.type = "file"; inp.accept = ".md,.markdown,.txt";
		inp.onchange = function () {
			var f = inp.files[0]; if (!f) return;
			var r = new FileReader();
			r.onload = function () { newPostFromText(String(r.result || ""), f.name, null); };
			r.readAsText(f, "utf-8");
		};
		inp.click();
	});
	$("#postNew").addEventListener("click", function () { newPostFromText("", null, null); });
	$("#postsSearch").addEventListener("input", function () { POSTS_STATE.q = this.value.trim().toLowerCase(); renderPostsList(); });
	$$('#v-posts [data-sort="list"] button').forEach(function (b) {
		b.addEventListener("click", function () {
			$$('#v-posts [data-sort="list"] button').forEach(function (x) { x.classList.remove("on"); });
			b.classList.add("on");
			POSTS_STATE.sort = b.getAttribute("data-by");
			renderPostsList();
		});
	});
	$$('#v-posts [data-filter="posts"] button').forEach(function (b) {
		b.addEventListener("click", function () {
			$$('#v-posts [data-filter="posts"] button').forEach(function (x) { x.classList.remove("on"); });
			b.classList.add("on");
			POSTS_STATE.filter = b.getAttribute("data-f");
			renderPostsList();
		});
	});
	/* .md / 图片拖拽统一由全局处理器接管（initGlobalDnd）：图片→图床→插入外链 */
	loadPostsWithMeta().then(function (posts) {
		$("#postsCount").textContent = posts.length + " 篇 · " + Object.keys(postCats(posts)).length + " 个分类";
		renderPostsList();
	}).catch(function (e) {
		$("#postsCatList").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>';
	});
}
function postMatches(p) {
	var st = POSTS_STATE;
	if (st.filter === "draft" && p.fm.draft === false) return false;
	if (st.filter === "pin" && !p.fm.pinned && !p.fm.featured) return false;
	if (st.q) {
		var hay = (String(p.fm.title || "") + " " + JSON.stringify(p.fm.tags || [])).toLowerCase();
		if (hay.indexOf(st.q) < 0) return false;
	}
	return true;
}
function renderPostsList() {
	var posts = CACHE.posts || [];
	var cats = postCats(posts);
	var keys = Object.keys(cats);
	var ci = 0, html = '<div class="list-empty" id="postsEmpty" hidden>没有匹配的文章 —— 换个关键词或清空筛选试试。</div>';
	keys.forEach(function (c) {
		var items = cats[c].filter(postMatches).sort(function (a, b) {
			if (POSTS_STATE.sort === "title") return String(a.fm.title || "").localeCompare(String(b.fm.title || ""));
			return String(b.fm.published || "").localeCompare(String(a.fm.published || ""));
		});
		if (!items.length) return;
		var color = CAT_COLORS[ci++ % CAT_COLORS.length];
		html += '<div class="cat-group" data-cat="' + esc(c) + '">' +
			'<button class="cat-head" type="button" aria-expanded="false"><span class="cat-caret"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M9 6l6 6-6 6"/></svg></span><i class="cat-dot" style="background:' + color + '"></i><span class="cat-nm">' + esc(c) + '</span><span class="cat-n num">' + items.length + ' 篇</span></button>' +
			'<div class="cat-body">';
		items.forEach(function (p) {
			var date = String(p.fm.published || "").slice(0, 10);
			var tags = (p.fm.tags || []).map(function (t) { return '<span class="pill" style="padding:0 6px">' + esc(t) + "</span>"; }).join(" ");
			var pin = (p.fm.pinned || p.fm.featured) ? '<span class="pill accent" style="padding:0 6px">置顶</span> ' : "";
			var draft = p.fm.draft === true ? '<span class="pill warn" style="padding:0 6px">草稿</span> ' : "";
			html += '<div class="list-item" data-sel data-path="' + esc(p.file.path) + '"><div class="list-thumb" style="background:var(--bg-inset);font-size:11px">·</div><div class="list-main"><div class="list-t" title="' + esc(p.fm.title || p.file.name) + '">' + esc(p.fm.title || p.file.name) + '</div><div class="list-s">' + date + " " + pin + draft + tags + '</div></div></div>';
		});
		html += '</div></div>';
	});
	$("#postsCatList").innerHTML = html;
	$("#postsNote").innerHTML = '按分类分组 · <b class="num">' + keys.length + '</b> 类 <b class="num">' + posts.length + '</b> 篇';
	/* 展开状态：与预览稿一致用 .open 类；筛选/搜索激活时全部展开，清空后恢复记忆 */
	var filtering = !!(POSTS_STATE.q || (POSTS_STATE.filter && POSTS_STATE.filter !== "all"));
	$$("#postsCatList .cat-group").forEach(function (g) {
		var on = filtering ? true : !!POSTS_STATE.catOpen[g.getAttribute("data-cat")];
		g.classList.toggle("open", on);
		var h = g.querySelector(".cat-head");
		if (h) h.setAttribute("aria-expanded", on ? "true" : "false");
	});
	$$("#postsCatList .cat-head").forEach(function (b) {
		b.addEventListener("click", function () {
			var g = b.parentNode;
			var on = g.classList.toggle("open");
			b.setAttribute("aria-expanded", on ? "true" : "false");
			POSTS_STATE.catOpen[g.getAttribute("data-cat")] = on;
		});
	});
	$$("#postsCatList .list-item").forEach(function (it) {
		it.addEventListener("click", function () { openPost(it.getAttribute("data-path")); });
	});
}
function findPost(path) { return (CACHE.posts || []).filter(function (p) { return p.file.path === path; })[0] || null; }
function openPost(path) {
	var p = findPost(path);
	if (!p) return;
	POSTS_STATE.sel = path;
	$$("#postsCatList .list-item").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-path") === path); });
	var fm = p.fm;
	var cats = Object.keys(postCats(CACHE.posts || []));
	if (fm.category && cats.indexOf(fm.category) < 0) cats.push(fm.category);
	var catOpts = cats.map(function (c) { return '<option' + (c === fm.category ? " selected" : "") + '>' + esc(c) + "</option>"; }).join("") + '<option>+ 新建分类…</option>';
	var tagsHtml = (fm.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + ' <b>×</b></span>'; }).join("");
	$("#postPanel").innerHTML =
		'<div class="card"><div class="card-head"><h2 class="card-title">frontmatter</h2><span class="pill">表单</span>' +
		'<span class="card-sub" style="margin-left:auto">' + esc(p.file.path) + '</span></div><div class="card-body">' +
		'<div class="form-grid">' +
		'<div class="f wide"><label class="f-label">标题<span class="req">*</span></label><input class="inp" id="pfTitle" value="' + esc(fm.title || "") + '"></div>' +
		'<div class="f"><label class="f-label">发布日期<span class="req">*</span></label><input class="inp" id="pfDate" type="date" value="' + esc(String(fm.published || "").slice(0, 10)) + '"></div>' +
		'<div class="f"><label class="f-label">分类</label><select class="inp" id="pfCat">' + catOpts + '</select></div>' +
		'<div class="f wide"><label class="f-label">标签</label><div class="tags" id="pfTagsBox">' + tagsHtml + '<input placeholder="输入后回车"></div></div>' +
		'<div class="f wide"><label class="f-label">摘要</label><textarea class="inp" id="pfSum" rows="2">' + esc(fm.description || "") + '</textarea></div>' +
		'<div class="f wide"><label class="f-label">封面</label><div class="inp-inline"><input class="inp" id="pfCover" value="' + esc(fm.image || "") + '"><button class="btn btn-sm btn-primary" type="button" id="pfCoverUp">上传到图床</button></div></div>' +
		'<div class="f"><label class="f-label">草稿</label><label class="sw"><input type="checkbox" id="pfDraft"' + (fm.draft === false ? "" : " checked") + '><i></i></label></div>' +
		'<div class="f"><label class="f-label">置顶</label><label class="sw"><input type="checkbox" id="pfPin"' + (fm.pinned || fm.featured ? " checked" : "") + '><i></i></label></div>' +
		'</div></div></div>' +
		'<div class="card"><div class="card-head"><div class="tabs" style="border:0">' +
		'<button class="tab on" data-tab="md">Markdown 源码</button><button class="tab" data-tab="pv">实时预览</button><button class="tab" data-tab="df">变更 diff</button></div>' +
		'<div style="margin-left:auto" class="toolbar"><button class="btn btn-sm" type="button" id="pfImgIns">🖼 插入图床图片</button></div></div>' +
		'<div class="card-body"><div data-tabpanel="md"><textarea class="inp mono ed-area" id="pfBody" style="min-height:380px;font-size:12.5px">' + esc(p.body) + '</textarea></div>' +
		'<div data-tabpanel="pv" style="display:none"><div class="md-preview-note"><span class="pill ok">与线上同管线</span>这个预览用<b>线上真正的渲染结构</b>（<span class="mono">.markdown-content</span>）渲染。</div>' +
		'<div class="md-preview markdown-content" id="pfPreview"></div></div>' +
		'<div data-tabpanel="df" style="display:none"><div class="block"><div class="block-head">前后对比（只替换 frontmatter + 正文）</div><div class="row"><div class="row-k mono" style="font-size:12px;white-space:pre-wrap" id="pfDiff">（尚未修改）</div></div></div></div>' +
		'</div></div>' +
		'<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" type="button" id="pfSave">💾 存入暂存区</button><div style="flex:1"></div><button class="btn btn-danger" type="button" id="pfDel">🗑 删除文章</button></div>';
	var PF = {
		title: fm.title || "", published: fm.published || "", category: fm.category || "",
		description: fm.description || "", image: fm.image || "", tags: (fm.tags || []).slice(),
		draft: fm.draft !== false, pinned: !!(fm.pinned || fm.featured), body: p.body
	};
	function bodyVal() { return $("#pfBody").value; }
	function fmVal() {
		var cat = $("#pfCat").value;
		if (cat === "+ 新建分类…") { var v = prompt("输入新分类名："); if (v) { cat = v; } else cat = PF.category; }
		return {
			title: $("#pfTitle").value,
			published: $("#pfDate").value ? $("#pfDate").value + String(PF.published || "").slice(10) : "",
			category: cat,
			description: $("#pfSum").value,
			image: $("#pfCover").value,
			tags: $$("#pfTagsBox .tag").map(function (t) { return t.textContent.replace(/×$/, "").trim(); }),
			draft: !$("#pfDraft").checked,
			pinned: $("#pfPin").checked,
		};
	}
	function originalFm() { return p.raw.slice(0, p.raw.indexOf("---", 3) + 3) ? MDM.parse(p.raw).data : {}; }
	function diffText() {
		var nf = fmVal(), of = fm, lines = [];
		Object.keys(nf).forEach(function (k) {
			var a = JSON.stringify(of[k] == null ? null : of[k]), b = JSON.stringify(nf[k]);
			if (a !== b) lines.push("- " + k + ": " + a + "\n+ " + k + ": " + b);
		});
		if (nfBodyChanged()) lines.push("+ 正文有修改（" + bodyVal().length + " 字符）");
		return lines.join("\n") || "（尚未修改）";
	}
	function nfBodyChanged() { return bodyVal() !== p.body; }
	/* 标签交互 */
	(function () {
		var box = $("#pfTagsBox"), inp = box.querySelector("input");
		box.addEventListener("click", function (e) {
			var b = e.target.closest(".tag b");
			if (b) b.parentNode.remove();
		});
		inp.addEventListener("keydown", function (e) {
			if (e.key === "Enter" && inp.value.trim()) {
				e.preventDefault();
				var t = el("span", "tag"); t.innerHTML = esc(inp.value.trim()) + ' <b>×</b>';
				box.insertBefore(t, inp); inp.value = "";
			}
		});
	})();
	bindImgUpload($("#pfCoverUp"), $("#pfCover"));
	$("#pfBody").addEventListener("input", function () { DIRTY = true; $("#pfDiff").textContent = diffText(); });
	["pfTitle", "pfDate", "pfSum", "pfCover"].forEach(function (id) {
		$("#" + id).addEventListener("input", function () { DIRTY = true; $("#pfDiff").textContent = diffText(); });
	});
	/* tabs */
	$$('#postPanel .tab').forEach(function (b) {
		b.addEventListener("click", function () {
			$$('#postPanel .tab').forEach(function (x) { x.classList.remove("on"); });
			b.classList.add("on");
			var tab = b.getAttribute("data-tab");
			$$("#postPanel [data-tabpanel]").forEach(function (pn) { pn.style.display = pn.getAttribute("data-tabpanel") === tab ? "" : "none"; });
			if (tab === "pv") renderMdPreview($("#pfBody").value, $("#pfPreview"));
			if (tab === "df") $("#pfDiff").textContent = diffText();
		});
	});
	$("#pfImgIns").addEventListener("click", function () { insertImgToTextarea($("#pfBody")); });
	$("#pfDel").addEventListener("click", function () {
		if (!confirm("删除文章 " + p.file.path + "？（先入暂存区，推送后生效）")) return;
		stageDelete(p.file.path, p.fm.title || p.file.name);
	});
	$("#pfSave").addEventListener("click", function () {
		var nf = fmVal();
		var content = MDM.stringify(nf, bodyVal());
		DIRTY = false;
		stagePut(p.file.path, content, nf.title || p.file.name);
	});
	/* 窄屏主操作条 */
	var msave = $("[data-msave]");
	if (msave && !msave.dataset.bound) {
		msave.dataset.bound = "1";
		msave.addEventListener("click", function () { $("#pfSave").click(); });
	}
}
function renderMdPreview(mdText, target) {
	if (!target) return;
	try {
		var md = window.markdownit({ html: true, linkify: true, breaks: true });
		target.innerHTML = md.render(mdText || "");
	} catch (e) { target.textContent = "预览失败：" + e.message; }
}
function insertImgToTextarea(ta) {
	var inp = document.createElement("input");
	inp.type = "file"; inp.accept = "image/*";
	inp.onchange = function () {
		var f = inp.files[0]; if (!f) return;
		uploadToImgbed(f).then(function (r) { return r.json(); }).then(function (j) {
			if (j && j.url) {
				var pos = ta.selectionStart || ta.value.length;
				ta.value = ta.value.slice(0, pos) + "![](" + j.url + ")" + ta.value.slice(pos);
				DIRTY = true;
				toast("已插入图片");
			} else throw new Error((j && j.error) || "上传失败");
		}).catch(function (e) { toast("上传失败：" + e.message); });
	};
	inp.click();
}
function parseMd(text) {
	var out = { body: text };
	var m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!m) return out;
	out.body = text.slice(m[0].length).replace(/^\r?\n+/, "");
	var head = m[1];
	var g = function (k) {
		var mm = head.match(new RegExp("^" + k + "\\s*:\\s*(.*)$", "m"));
		return mm ? mm[1].trim().replace(/^["']|["']$/g, "") : null;
	};
	out.title = g("title");
	out.date = g("published") || g("date");
	out.cat = g("category");
	out.sum = g("description");
	var dr = g("draft");
	out.draft = dr == null ? true : dr.toLowerCase() === "true";
	return out;
}
function newPostFromText(text, fromName, preset) {
	var P = preset || parseMd(text || "");
	go("posts");
	if (!CACHE.posts) { toast("文章列表还在加载，稍后再试"); return; }
	if (!P.title) P.title = "未命名文章";
	if (!P.date) P.date = today();
	if (!P.draft) P.draft = true;
	var today_ = today();
	var cats = Object.keys(postCats(CACHE.posts || []));
	var catOpts = cats.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + '<option>+ 新建分类…</option>';
	$("#postPanel").innerHTML =
		'<div class="card"><div class="card-head"><h2 class="card-title">frontmatter</h2><span class="pill">新文章草稿</span></div><div class="card-body">' +
		'<div class="form-grid">' +
		'<div class="f wide"><label class="f-label">标题<span class="req">*</span></label><input class="inp" id="pfTitle" value="' + esc(P.title) + '"></div>' +
		'<div class="f"><label class="f-label">发布日期<span class="req">*</span></label><input class="inp" id="pfDate" type="date" value="' + esc(P.date.slice(0, 10)) + '"></div>' +
		'<div class="f"><label class="f-label">分类</label><select class="inp" id="pfCat">' + catOpts + '</select></div>' +
		'<div class="f wide"><label class="f-label">标签</label><div class="tags" id="pfTagsBox"><input placeholder="输入后回车"></div></div>' +
		'<div class="f wide"><label class="f-label">摘要</label><textarea class="inp" id="pfSum" rows="2">' + esc(P.sum || "") + '</textarea></div>' +
		'<div class="f"><label class="f-label">草稿</label><label class="sw"><input type="checkbox" id="pfDraft" checked><i></i></label></div>' +
		'</div></div></div>' +
		'<div class="card"><div class="card-head"><div class="tabs" style="border:0"><button class="tab on" data-tab="md">Markdown 源码</button><button class="tab" data-tab="pv">实时预览</button></div></div>' +
		'<div class="card-body"><div data-tabpanel="md"><textarea class="inp mono ed-area" id="pfBody" style="min-height:380px;font-size:12.5px">' + esc(P.body || "") + '</textarea></div>' +
		'<div data-tabpanel="pv" style="display:none"><div class="md-preview markdown-content" id="pfPreview"></div></div></div></div>' +
		'<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" type="button" id="pfSave">💾 存入暂存区</button></div>';
	var slug = P.title.replace(/[^\w\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 40) || "new-post";
	var path = "content/posts/" + today_ + "-" + slug + ".md";
	$("#pfSave").addEventListener("click", function () {
		var cat = $("#pfCat").value;
		if (cat === "+ 新建分类…") { var v = prompt("输入新分类名："); cat = v || "未分类"; }
		var fm = {
			title: $("#pfTitle").value, published: $("#pfDate").value, category: cat,
			description: $("#pfSum").value, tags: $$("#pfTagsBox .tag").map(function (t) { return t.textContent.replace(/×$/, "").trim(); }),
			draft: !$("#pfDraft").checked,
		};
		DIRTY = false;
		stagePut(path, MDM.stringify(fm, $("#pfBody").value), fm.title);
	});
	$$('#postPanel .tab').forEach(function (b) {
		b.addEventListener("click", function () {
			$$('#postPanel .tab').forEach(function (x) { x.classList.remove("on"); });
			b.classList.add("on");
			var tab = b.getAttribute("data-tab");
			$$("#postPanel [data-tabpanel]").forEach(function (pn) { pn.style.display = pn.getAttribute("data-tabpanel") === tab ? "" : "none"; });
			if (tab === "pv") renderMdPreview($("#pfBody").value, $("#pfPreview"));
		});
	});
	var t = $("#pfTitle"); if (t) setTimeout(function () { t.focus(); }, 60);
	var banner = $("#pfMode");
	banner.hidden = false;
	banner.innerHTML = '<span>🆕 新建文章草稿</span><span style="font-weight:500">' + (fromName ? "来自 " + esc(fromName) + " · " : "") + '标题、日期、分类已按实际 frontmatter 字段生成，改完「💾 存入暂存区」即可</span><button class="btn btn-sm mb-x" type="button" id="pfModeX">取消新建</button>';
	$("#pfModeX").addEventListener("click", function () { banner.hidden = true; banner.innerHTML = ""; });
	toast(fromName ? "已根据 " + fromName + " 建立新文章草稿" : "已新建文章草稿，开始写吧");
}
/* 说明：.md / 图片的拖拽不再走页面级 bindMdDrop，统一由全局 initGlobalDnd 接管
   —— 图片→图床（或相册）→ 插入外链；.md→笔记本批量导入 / 其他页新建文章。 */

/* ================= 通用数据页（schema 驱动 · 预览稿皮肤） ================= */
var DATA_SEL = {};
function renderDataPage(id) {
	var schema = window.getSchema(id);
	if (!schema) return;
	schema.__id = id; /* schema 对象本身无 id 字段，补挂后 loadView(schema.id)/特化分支才能用 */
	schema.id = id;
	var v = $("#v-" + id);
	v.innerHTML = pageHead(schema.icon || "db", schema.label,
		'<span class="mono">' + esc(schema.path) + '</span>' + (schema.varName ? ' · varName <span class="mono">' + esc(schema.varName) + '</span>' : ""),
		'<button class="btn btn-primary" type="button" id="dpAdd">+ 新增</button>') +
		'<div class="split"><div class="card split-list"><div id="dpList"><div class="empty-block">加载中…</div></div></div>' +
		'<div id="dpPanel"><div class="card"><div class="card-body"><div class="empty-block">从左侧选择一个条目，或点「+ 新增」</div></div></div></div></div>' +
		'<div id="dpHint"></div>';
	$("#dpAdd", v).addEventListener("click", function () {
		getTs(schema).then(function (ts) {
			var arr = ts.value;
			var item = { id: nextId(arr) };
			schema.fields.forEach(function (fd) { if (item[fd.key] === undefined && !fd.hidden) item[fd.key] = fd.type === "boolean" ? false : ""; });
			if (schema.__id === "diary" || schema.id === "diary") item.date = nowISO();
			editDataItem(schema, ts, item, true);
		}).catch(function (e) { $("#dpList", v).innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
	});
	getTs(schema).then(function (ts) {
		var arr = Array.isArray(ts.value) ? ts.value : [];
		renderDataList(schema, arr);
	}).catch(function (e) {
		$("#dpList", v).innerHTML = '<div class="error-block">' + esc(e.message) + '</div>';
	});
	bindDataSave(schema);
}
function nextId(arr) {
	var m = 0;
	(arr || []).forEach(function (it) { if (it && it.id > m) m = it.id; });
	return m + 1;
}
function dataItemLabel(schema, it) {
	if (typeof schema.itemLabel === "function") return schema.itemLabel(it);
	if (schema.itemLabel && it[schema.itemLabel] != null) return String(it[schema.itemLabel]);
	return it.id != null ? "条目 #" + it.id : (it.name || it.title || "条目");
}
function dataItemSub(schema, it) {
	if (schema.id === "diary") return String(it.date || "");
	if (schema.id === "friends") return String(it.url || "").replace(/^https?:\/\//, "");
	if (schema.id === "projects") {
		var st = it.status || "";
		var cls = st === "completed" ? "ok" : st === "in-progress" ? "info" : "warn";
		return '<span class="pill ' + cls + '" style="padding:0 6px">' + esc(st) + '</span> <span class="pill" style="padding:0 6px">' + esc(it.category || "") + '</span>';
	}
	if (schema.id === "anime") {
		var st2 = it.status || "";
		var cls2 = st2 === "completed" ? "ok" : st2 === "watching" ? "info" : "warn";
		return '<span class="pill ' + cls2 + '" style="padding:0 6px">' + esc(st2) + '</span> <span class="num">' + esc(it.rating || "") + '</span>';
	}
	if (schema.id === "website") return esc(String(it.url || "").replace(/^https?:\/\//, "")) + ' · <span class="pill" style="padding:0 6px">' + esc(it.category || "") + '</span>';
	return esc(it.date || it.category || "");
}
function dataItemThumb(schema, it) {
	if (schema.id === "friends" && it.name) return esc(String(it.name).slice(0, 1));
	if (schema.id === "diary") return it.mood ? esc(it.mood.slice(0, 2)) : "🌙";
	return "📄";
}
function renderDataList(schema, arr) {
	var box = $("#dpList", $("#v-" + (schema.__id || schema.id)) || document);
	box.innerHTML = "";
	/* 「动态管理」按时间倒序 —— 内容仓 diary.ts 里新条目是追加在文件末尾的，
	   不做排序就会把最新的几条压到列表最底部（2026-10-05 修复）。 */
	var list = arr;
	if (schema && schema.id === "diary") {
		list = arr.slice().sort(function (a, b) {
			return String((b && b.date) || "").localeCompare(String((a && a.date) || ""));
		});
	}
	list.forEach(function (it, i) {
		var row = el("div", "list-item" + (DATA_SEL[schema.id] === i ? " on" : ""));
		row.setAttribute("data-sel", "");
		row.setAttribute("data-i", i);
		row.innerHTML = '<div class="list-thumb">' + dataItemThumb(schema, it) + '</div><div class="list-main"><div class="list-t">' + esc(dataItemLabel(schema, it)) + '</div><div class="list-s">' + dataItemSub(schema, it) + '</div></div>';
		row.addEventListener("click", function () { editDataItem(schema, CACHE["ts:" + schema.path], it, false, i); });
		box.appendChild(row);
	});
	if (!arr.length) box.innerHTML = '<div class="empty-block">暂无条目，点右上角「+ 新增」</div>';
}
function editDataItem(schema, ts, item, isNew, idx) {
	var vw = $("#v-" + (schema.__id || schema.id)) || document;
	DATA_SEL[schema.id] = idx;
	$$("#dpList .list-item", vw).forEach(function (x) { x.classList.toggle("on", Number(x.getAttribute("data-i")) === idx); });
	var panel = $("#dpPanel", vw);
	panel.innerHTML = '<div class="card"><div class="card-head"><h2 class="card-title">' + (isNew ? "新增" : esc(dataItemLabel(schema, item))) + '</h2><span class="pill">ts-array</span>' +
		(schema.id === "diary" ? '<span class="card-sub" style="margin-left:auto">隐藏 id 自动自增</span>' : (item.id != null ? '<span class="card-sub" style="margin-left:auto">id <span class="num">' + item.id + '</span>（隐藏）</span>' : '')) +
		'</div><div class="card-body" id="dpForm">' + renderFields(schema.fields, item) + '</div></div>' + saveBar(id_new(schema));
	var saveId = id_new(schema);
	bindFields($("#dpForm", vw), item);
	bindDataSave(schema);
	function collect() {
		var out = {};
		schema.fields.forEach(function (fd) {
			if (fd.hidden) { out[fd.key] = item[fd.key]; return; }
			out[fd.key] = item[fd.key];
		});
		return out;
	}
	var saveBtn = $('[data-save="' + saveId + '"]');
	if (saveBtn && !saveBtn.dataset.itembound) {
		saveBtn.dataset.itembound = "1";
		saveBtn.addEventListener("click", function () {
			getTs(schema).then(function (ts2) {
				var arr = ts2.value;
				if (isNew) arr.push(item);
				var content = TSIO.replace(ts2.raw, schema.varName, arr); /* 传值，replace 内部自行序列化；传字符串会被双重编码成带引号的 string */
				clearTs(schema);
				DIRTY = false;
				stagePut(schema.path, content, schema.label);
				toast("已暂存：" + schema.label);
				loadView(schema.id, true);
			});
		});
	}
	var delBtn = $('[data-del="' + saveId + '"]');
	if (delBtn && !delBtn.dataset.itembound) {
		delBtn.dataset.itembound = "1";
		delBtn.addEventListener("click", function () {
			if (isNew) { loadView(schema.id, true); return; }
			if (!confirm("删除该条目？（先入暂存区）")) return;
			getTs(schema).then(function (ts2) {
				var arr = ts2.value.filter(function (x) { return x !== item; });
				var content = TSIO.replace(ts2.raw, schema.varName, arr);
				clearTs(schema);
				stagePut(schema.path, content, schema.label + "（删除一条）");
				loadView(schema.id, true);
			});
		});
	}
}
function id_new(schema) { return "dp-" + (schema.__id || schema.id || "x"); }
function bindDataSave(schema) {
	/* 顶部页头无独立保存按钮；条目编辑面板里的 data-save 已单独绑定 */
	var sid = id_new(schema);
	$$('[data-save="' + sid + '"]').forEach(function (b) { if (!b.dataset.topbound) b.dataset.topbound = "1"; });
}

/* ================= 关于页面（md-file） ================= */
function renderAbout() {
	var v = $("#v-about");
	v.innerHTML = pageHead("about", "关于页面", '<span class="mono">content/spec/about.md</span> · markdown-frontmatter 混合') +
		'<div class="card"><div class="card-head"><h2 class="card-title">frontmatter</h2><span class="pill">md-file</span></div>' +
		'<div class="card-body"><div class="form-grid" id="abFm"><div class="empty-block">加载中…</div></div></div></div>' +
		'<div class="card"><div class="card-head"><div class="tabs" style="border:0"><button class="tab on" data-tab="a1">正文（Markdown）</button><button class="tab" data-tab="a2">预览</button></div></div>' +
		'<div class="card-body"><div data-tabpanel="a1"><textarea class="inp mono ed-area" id="abBody" style="min-height:300px;font-size:12.5px"></textarea></div>' +
		'<div data-tabpanel="a2" style="display:none"><div class="card" style="box-shadow:none;background:var(--bg-inset)"><div class="card-body"><div class="md-preview markdown-content" id="abPreview"></div></div></div></div></div></div>' +
		'<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" type="button" id="abSave">💾 存入暂存区</button></div>';
	GIT.getFile(OWNER, REPO, "content/spec/about.md", BRANCH).then(function (f) {
		if (!f) { $("#abFm").innerHTML = '<div class="error-block">文件不存在</div>'; return; }
		var p = MDM.parse(f.content);
		var fm = p.data || {};
		window.__ABOUT = { sha: f.sha, raw: f.content, fm: fm, body: p.body || "" };
		$("#abFm").innerHTML = '<div class="f"><label class="f-label">标题</label><input class="inp" id="abTitle" value="' + esc(fm.title || "") + '"></div>' +
			'<div class="f"><label class="f-label">描述</label><input class="inp" id="abDesc" value="' + esc(fm.description || "") + '"></div>';
		$("#abBody").value = p.body || "";
		$$('#v-about .tab').forEach(function (b) {
			b.addEventListener("click", function () {
				$$('#v-about .tab').forEach(function (x) { x.classList.remove("on"); });
				b.classList.add("on");
				var tab = b.getAttribute("data-tab");
				$$("#v-about [data-tabpanel]").forEach(function (pn) { pn.style.display = pn.getAttribute("data-tabpanel") === tab ? "" : "none"; });
				if (tab === "a2") renderMdPreview($("#abBody").value, $("#abPreview"));
			});
		});
		$("#abSave").addEventListener("click", function () {
			var nfm = { title: $("#abTitle").value, description: $("#abDesc").value };
			DIRTY = false;
			stagePut("content/spec/about.md", MDM.stringify(nfm, $("#abBody").value), "关于页面");
		});
		["abTitle", "abDesc", "abBody"].forEach(function (id) { $("#" + id).addEventListener("input", function () { DIRTY = true; }); });
	}).catch(function (e) { $("#abFm").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
}


/* ================= 相册管理 ================= */
/* 存储：内容仓 content/images/albums/<相册名>/
   - 本地模式（默认）：info.json + cover.webp/cover.jpg + 若干图片；照片由构建期自动扫描
   - 外链模式（info.mode === "external"）：info.json 里存 cover + photos[].src
   线上路径：/images/albums/<相册名>/<文件名>（构建期由内容仓同步到 public/images） */
var AL_VER = "ed" + Date.now().toString(36);   /* 同一次会话内复用，绕开 CDN 旧缓存 */
var AL_UPLOADED = {};                           /* path -> { b64, url } 本会话刚上传的图片（无需等部署即可预览） */
var AL_STATE = { d: null, info: null, files: [], mode: "local", edit: {} };

function safeName(n) {
	return String(n == null ? "" : n)
		.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
		.replace(/^\.+/, "")
		.replace(/\.+$/, "")
		.trim() || "";
}
function isImgName(n) { return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(String(n || "")); }
function albumUrl(dir, file) {
	return "/images/albums/" + encodeURIComponent(dir) + "/" + encodeURIComponent(file) + "?v=" + AL_VER;
}
function fileToBase64(file) {
	return new Promise(function (res, rej) {
		var r = new FileReader();
		r.onload = function () {
			var s = String(r.result || "");
			var i = s.indexOf(",");
			res(i >= 0 ? s.slice(i + 1) : "");
		};
		r.onerror = function () { rej(new Error("读取失败")); };
		r.readAsDataURL(file);
	});
}
/** 目录列表 = GitHub 上的文件 ∪ 暂存区里新增的（− 暂存区里删除的） */
function listAlbumDir(dirPath) {
	return GIT.listDir(OWNER, REPO, dirPath, BRANCH).then(function (files) {
		var map = {};
		files.forEach(function (f) { map[f.path] = f; });
		Object.keys(STAGED).forEach(function (p) {
			if (p.indexOf(dirPath + "/") !== 0) return;
			if (p.slice(dirPath.length + 1).indexOf("/") >= 0) return;
			var it = STAGED[p];
			if (it.del) { delete map[p]; return; }
			map[p] = { name: p.split("/").pop(), type: "file", path: p, staged: true };
		});
		return Object.keys(map).map(function (k) { return map[k]; });
	}).catch(function () { return []; });
}
/** 读 info.json：优先读暂存区里未推送的版本 */
function readAlbumInfo(dirPath) {
	var p = dirPath + "/info.json";
	var it = STAGED[p];
	if (it) return Promise.resolve(it.del ? null : { content: it.content, sha: null, staged: true });
	return GIT.getFile(OWNER, REPO, p, BRANCH);
}
/** 相册名列表（含仅存在于暂存区的「新相册」） */
function albumDirNames() {
	return GIT.listDir(OWNER, REPO, "content/images/albums", BRANCH).then(function (dirs) {
		var names = dirs.filter(function (d) { return d.type === "dir"; }).map(function (d) { return d.name; });
		Object.keys(STAGED).forEach(function (p) {
			if (p.indexOf("content/images/albums/") !== 0) return;
			if (STAGED[p].del) return;
			var nm = p.slice("content/images/albums/".length).split("/")[0];
			if (!nm || nm === ".gitkeep") return;
			if (names.indexOf(nm) < 0) names.push(nm);
		});
		return names;
	});
}
/** 相册列表行副标题：模式 · 张数 · 隐藏 · 加密 */
function albumSubInfo(info, files) {
	var ext = info.mode === "external";
	var n = ext ? (Array.isArray(info.photos) ? info.photos.length : 0)
		: files.filter(function (x) { return isImgName(x.name) && !/^cover\.(webp|jpg|jpeg|png)$/i.test(x.name); }).length;
	return (ext ? "外链" : "本地") + " · " + n + " 张" + (info.hidden === true ? " · 隐藏" : "") + (info.password ? " · 🔒" : "");
}
function fillAlbumSub(dir, row) {
	var sub = row && row.querySelector("[data-al-sub]");
	if (!sub) return;
	Promise.all([listAlbumDir(dir.path), readAlbumInfo(dir.path)]).then(function (rs) {
		var files = rs[0], f = rs[1], info = {};
		if (f && f.content) { try { info = JSON.parse(f.content) || {}; } catch (e) { info = {}; } }
		sub.textContent = albumSubInfo(info, files);
	}).catch(function () { sub.textContent = "读取失败"; });
}
function renderAlbums() {
	var v = $("#v-albums");
	v.innerHTML = pageHead("album", "相册管理", '<span class="mono">content/images/albums/</span> · 本地图片 / 外链两种模式 · 点任意图片看大图',
		'<button class="btn btn-primary" type="button" id="alNew">+ 新建相册</button>') +
		'<div class="split"><div class="card split-list">' +
		'<div class="card-head" style="padding:10px 12px"><span class="card-title">相册列表</span><span class="card-sub" style="margin-left:auto" id="alCount"></span></div>' +
		'<div id="alList"><div class="empty-block">加载中…</div></div></div>' +
		'<div id="alPanel"><div class="card"><div class="card-body"><div class="empty-block">从左侧选择一个相册，或点「+ 新建相册」</div></div></div></div></div>';
	$("#alNew").addEventListener("click", createAlbum);
	albumDirNames().then(function (names) {
		var box = $("#alList");
		if ($("#alCount")) $("#alCount").textContent = names.length + " 个";
		if (!names.length) { box.innerHTML = '<div class="empty-block">暂无相册，点右上角「+ 新建相册」</div>'; return; }
		box.innerHTML = "";
		names.forEach(function (nm, i) {
			var d = { name: nm, path: "content/images/albums/" + nm };
			var row = el("div", "list-item" + (i === 0 ? " on" : ""));
			row.setAttribute("data-sel", "");
			row.innerHTML = '<div class="list-thumb">💌</div><div class="list-main"><div class="list-t">' + esc(nm) + '</div><div class="list-s" data-al-sub>…</div></div>';
			row.addEventListener("click", function () {
				$$("#alList .list-item").forEach(function (x) { x.classList.remove("on"); });
				row.classList.add("on");
				loadAlbum(d, row);
			});
			box.appendChild(row);
			fillAlbumSub(d, row);
			if (i === 0) loadAlbum(d, row);
		});
	}).catch(function (e) { $("#alList").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
}
function loadAlbum(dir, row) {
	AL_STATE.d = dir;
	$("#alPanel").innerHTML = '<div class="card"><div class="card-body">' + loading("读取 " + dir.name + " …") + '</div></div>';
	Promise.all([listAlbumDir(dir.path), readAlbumInfo(dir.path)]).then(function (rs) {
		var files = rs[0], f = rs[1], info = {};
		if (f && f.content) { try { info = JSON.parse(f.content) || {}; } catch (e) { info = {}; } }
		AL_STATE.files = files;
		AL_STATE.info = info;
		AL_STATE.mode = info.mode === "external" ? "external" : "local";
		try { AL_STATE.edit = JSON.parse(JSON.stringify(info)); } catch (e2) { AL_STATE.edit = {}; }
		if (row) {
			var sub = row.querySelector("[data-al-sub]");
			if (sub) sub.textContent = albumSubInfo(info, files);
		}
		renderAlbumPanel();
	}).catch(function (e) { $("#alPanel").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
}
function renderAlbumPanel() {
	var d = AL_STATE.d, info = AL_STATE.info || {}, isExt = AL_STATE.mode === "external";
	var coverFile = AL_STATE.files.filter(function (x) { return /^cover\.(webp|jpg|jpeg|png)$/i.test(x.name); })[0];
	var cover = isExt ? (info.cover || "")
		: (coverFile && AL_UPLOADED[coverFile.path] ? AL_UPLOADED[coverFile.path].url : (coverFile ? albumUrl(d.name, coverFile.name) : ""));
	var photos = isExt ? (Array.isArray(info.photos) ? info.photos : [])
		: AL_STATE.files.filter(function (x) { return isImgName(x.name) && !/^cover\.(webp|jpg|jpeg|png)$/i.test(x.name); });

	var h = '<div class="card"><div class="card-head"><h2 class="card-title">' + esc(info.title || d.name) + '</h2>' +
		'<span class="pill">' + (isExt ? "外链模式" : "本地图片") + '</span>' +
		'<span class="pill info" style="margin-left:6px">' + esc(d.name) + '</span></div><div class="card-body">';

	/* 封面 */
	h += '<div class="al-row" style="gap:14px;align-items:flex-start;flex-wrap:wrap">' +
		'<div class="ph-wrap" style="width:210px;flex:0 0 auto">' +
		'<div class="ph" data-imgprev="' + esc(cover) + '" data-name="封面" style="height:120px;border-radius:10px;border:1px solid var(--line);background-image:url(\'' + esc(cover) + '\')"></div>' +
		'<span class="ph-badge">封面</span></div>' +
		'<div style="flex:1 1 260px;min-width:0">' +
		'<div class="f-hint"><b>封面</b>：' + (isExt ? '外链模式存 <span class="mono">info.json.cover</span>' : '本地模式 = 该文件夹下的 <span class="mono">cover.webp</span>') + '</div>' +
		'<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
		'<button class="btn btn-sm" type="button" id="alUpCover">⬆ 上传封面</button>' +
		(isExt ? '' : '<button class="btn btn-sm" type="button" id="alCoverHint">设为某张图？点图片右上角</button>') +
		'</div></div></div><div class="hr" style="margin:14px 0"></div>';

	/* 元数据表单 */
	h += '<div id="alForm">' + renderFields(ALBUM_FIELDS, AL_STATE.edit, "") + '</div>';
	if (isExt) {
		h += '<div class="form-grid" style="margin-top:2px">' +
			fieldHtml({ key: "cover", label: "封面（外链）", type: "image" }, AL_STATE.edit.cover, "") + '</div>';
	}
	h += '<div class="hr" style="margin:14px 0"></div>';

	/* 照片区 */
	h += '<div class="al-row" style="margin-bottom:10px"><b>照片</b><span class="card-sub">' +
		(isExt ? photos.length + " 张外链" : photos.length + " 张本地图片") + '</span>' +
		'<div style="margin-left:auto;display:flex;gap:8px">' +
		(isExt ? '' : '<button class="btn btn-sm btn-primary" type="button" id="alUpImgs">⬆ 上传图片</button>') + '</div></div>';
	h += '<div class="nb-drop" data-al-drop><b>' + (isExt ? "把图片拖到这里 → 上传图床并追加外链" : "把图片拖到这里 → 直接加入本相册") +
		'</b><br>' + (isExt ? "上传成功后自动往下方「照片外链」文本框追加一行，记得保存。" : "支持一次拖多张；图片先进暂存区，统一推送后随部署上线。") + '</div>';

	if (isExt) {
		var lines = photos.map(function (p) { return p && p.src ? p.src : ""; }).filter(Boolean).join("\n");
		h += '<div class="f wide"><label class="f-label">照片外链（每行一条 <span class="mono">src</span>）</label>' +
			'<textarea class="inp mono" id="alPhotosText" rows="8" style="font-size:12px" placeholder="https://img.yujingblog.top/file/xxx.webp">' + esc(lines) + '</textarea>' +
			'<div class="f-hint">每行一条外链，保存后写入 <span class="mono">info.json</span> 的 <span class="mono">photos[].src</span>（其余字段按 src 保留）</div></div>';
	}

	if (photos.length) {
		h += '<div class="grid-img">' + photos.map(function (p) {
			var src, name, path, isCover2, coverIdx = -1;
			if (isExt) {
				src = p.src; name = p.alt || p.title || String(p.src || "").split("/").pop();
				coverIdx = photos.indexOf(p);
				isCover2 = !!info.cover && info.cover === p.src;
				return '<div class="thumb"><div class="ph-wrap">' +
					(isCover2 ? '<span class="ph-badge">封面</span>' : '') +
					'<div class="ph" data-imgprev="' + esc(src) + '" data-name="' + esc(name) + '" style="background-image:url(\'' + esc(src) + '\')"></div>' +
					'<div class="ph-ops">' + (isCover2 ? '' : '<button class="btn btn-sm" type="button" data-al-coverex="' + coverIdx + '">设为封面</button>') +
					'<button class="btn btn-sm" type="button" data-al-delex="' + coverIdx + '">删除</button></div></div>' +
					'<div class="cap">' + esc(name) + '</div></div>';
			}
			path = p.path; name = p.name;
			src = AL_UPLOADED[path] ? AL_UPLOADED[path].url : albumUrl(d.name, name);
			isCover2 = !!(coverFile && coverFile.name === name);
			return '<div class="thumb"><div class="ph-wrap">' +
				(isCover2 ? '<span class="ph-badge">封面</span>' : '') +
				(p.staged ? '<span class="ph-badge" style="left:auto;right:6px;top:auto;bottom:6px;background:rgba(217,130,43,.9)">待推送</span>' : '') +
				'<div class="ph" data-imgprev="' + esc(src) + '" data-name="' + esc(name) + '" style="background-image:url(\'' + esc(src) + '\')"></div>' +
				'<div class="ph-ops">' + (isCover2 ? '' : '<button class="btn btn-sm" type="button" data-al-cover="' + esc(path) + '">设为封面</button>') +
				'<button class="btn btn-sm" type="button" data-al-del="' + esc(path) + '">删除</button></div></div>' +
				'<div class="cap">' + esc(name) + '</div></div>';
		}).join("") + '</div>';
	} else {
		h += '<div class="empty-block alb-empty-hint">' + (isExt ? "还没有外链照片，在下方粘贴外链后保存" : "还没有图片 —— 点「⬆ 上传图片」，或直接把图片拖进本页") + '</div>';
	}

	/* 操作条 */
	h += '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">' +
		'<button class="btn btn-primary" type="button" id="alSave">💾 保存到暂存区</button>' +
		'<div style="flex:1"></div>' +
		'<button class="btn btn-danger" type="button" id="alDelAlbum">🗑 删除整个相册</button></div>' +
		'<div class="f-hint" style="margin-top:8px">改动先进入暂存区，最后在右上角「统一推送」一次性提交到内容仓；部署完成后线上相册自动更新。</div>';
	h += '</div></div>';
	$("#alPanel").innerHTML = h;

	/* 绑定 */
	bindFields($("#alPanel"), AL_STATE.edit);
	var upCoverBtn = $("#alUpCover");
	if (upCoverBtn) {
		upCoverBtn.addEventListener("click", function () {
			var inp = document.createElement("input");
			inp.type = "file"; inp.accept = "image/*";
			inp.onchange = function () {
				var f = inp.files[0]; if (!f) return;
				fileToBase64(f).then(function (b64) {
					/* 本地模式固定写 cover.webp；外链模式由用户自己填 URL（这里改成直接上传到图床） */
					if (isExt) {
						uploadToImgbed(f).then(function (r) { return r.json(); }).then(function (j) {
							if (j && j.url) {
								AL_STATE.edit.cover = j.url;
								var inp2 = $("#alPanel [data-fk='cover']");
								if (inp2) setFieldValue(inp2, j.url);
								toast("封面已上传到图床，记得保存");
							} else toast("上传失败");
						}).catch(function (e) { toast("上传失败：" + e.message); });
						return;
					}
					var p = d.path + "/cover.webp";
					stagePutBinary(p, b64, d.name + " / 封面");
					AL_UPLOADED[p] = { b64: b64, url: URL.createObjectURL(f) };
					AL_STATE.files = AL_STATE.files.filter(function (x) { return x.path !== p; });
					AL_STATE.files.push({ name: "cover.webp", type: "file", path: p, staged: true });
					toast("封面已暂存（cover.webp）");
					renderAlbumPanel();
				}).catch(function (e) { toast("读取失败：" + e.message); });
			};
			inp.click();
		});
	}
	var upImgs = $("#alUpImgs");
	if (upImgs) upImgs.addEventListener("click", function () {
		var inp = document.createElement("input");
		inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
		inp.onchange = function () { uploadAlbumPhotos(Array.prototype.slice.call(inp.files)); };
		inp.click();
	});
	var saveBtn = $("#alSave");
	if (saveBtn) saveBtn.addEventListener("click", saveAlbumInfo);
	var delBtn = $("#alDelAlbum");
	if (delBtn) delBtn.addEventListener("click", deleteAlbum);

	$$("#alPanel [data-al-cover]").forEach(function (b) {
		b.addEventListener("click", function (e) {
			e.stopPropagation();
			var p = b.getAttribute("data-al-cover");
			var b64 = AL_UPLOADED[p] ? AL_UPLOADED[p].b64 : null;
			var cp = d.path + "/cover.webp";
			var applyCover = function (data) {
				stagePutBinary(cp, data, d.name + " / 封面");
				AL_STATE.files = AL_STATE.files.filter(function (x) { return !/^cover\.(webp|jpg|jpeg|png)$/i.test(x.name); });
				AL_STATE.files.push({ name: "cover.webp", type: "file", path: cp, staged: true });
				if (!AL_UPLOADED[cp]) AL_UPLOADED[cp] = { url: albumUrl(d.name, p.split("/").pop()) };
				toast("已把这张设为封面（cover.webp）");
				renderAlbumPanel();
			};
			if (b64) { applyCover(b64); return; }
			/* 已在线上：抓回二进制再复制成 cover.webp */
			toast("正在读取原图…");
			fetch(albumUrl(d.name, p.split("/").pop()), { cache: "no-store" })
				.then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
				.then(function (bl) {
					var fr = new FileReader();
					fr.onload = function () {
						var s = String(fr.result || ""), i = s.indexOf(",");
						applyCover(i >= 0 ? s.slice(i + 1) : "");
					};
					fr.readAsDataURL(bl);
				})
				.catch(function (e) { toast("读取原图失败：" + e.message); });
		});
	});
	$$("#alPanel [data-al-del]").forEach(function (b) {
		b.addEventListener("click", function (e) {
			e.stopPropagation();
			var p = b.getAttribute("data-al-del");
			if (!confirm("删除这张图片？\n" + p.split("/").pop() + "\n（先入暂存区，推送后生效）")) return;
			stageDelete(p, d.name);
			AL_STATE.files = AL_STATE.files.filter(function (x) { return x.path !== p; });
			renderAlbumPanel();
		});
	});
	$$("#alPanel [data-al-coverex]").forEach(function (b) {
		b.addEventListener("click", function (e) {
			e.stopPropagation();
			var p = photos[Number(b.getAttribute("data-al-coverex"))];
			if (!p) return;
			AL_STATE.edit.cover = p.src;
			var inp = $("#alPanel [data-fk='cover']");
			if (inp) setFieldValue(inp, p.src);
			toast("已设为封面，记得点「保存到暂存区」");
		});
	});
	$$("#alPanel [data-al-delex]").forEach(function (b) {
		b.addEventListener("click", function (e) {
			e.stopPropagation();
			var idx = Number(b.getAttribute("data-al-delex"));
			var ta = $("#alPhotosText");
			if (!ta) return;
			var ls = ta.value.split(/\r?\n/).filter(function (s) { return s.trim(); });
			ls.splice(idx, 1);
			ta.value = ls.join("\n");
			toast("已从列表移除，记得点「保存到暂存区」");
		});
	});
}
var ALBUM_FIELDS = [
	{ key: "title", label: "标题", type: "string", required: true },
	{ key: "date", label: "日期", type: "date" },
	{ key: "location", label: "地点", type: "string" },
	{ key: "description", label: "描述", type: "text" },
	{ key: "tags", label: "标签", type: "tags" },
	{ key: "password", label: "访问密码（留空 = 不加密）", type: "string" },
	{ key: "passwordHint", label: "密码提示", type: "string" },
	{ key: "hidden", label: "在站点隐藏该相册", type: "boolean" }
];
function uploadAlbumPhotos(files) {
	var d = AL_STATE.d; if (!d) return;
	var list = (files || []).filter(isImageFile);
	if (!list.length) { toast("请选择图片文件"); return; }
	var i = 0, ok = 0;
	(function step() {
		if (i >= list.length) {
			toast("已暂存 " + ok + " 张图片，记得点「统一推送」");
			renderAlbumPanel();
			return;
		}
		var f = list[i++];
		fileToBase64(f).then(function (b64) {
			var nm = safeName(f.name || ("upload-" + Date.now() + ".webp"));
			if (!nm) nm = "upload-" + Date.now() + ".webp";
			var p = d.path + "/" + nm;
			stagePutBinary(p, b64, d.name);
			AL_UPLOADED[p] = { b64: b64, url: URL.createObjectURL(f) };
			AL_STATE.files = AL_STATE.files.filter(function (x) { return x.path !== p; });
			AL_STATE.files.push({ name: nm, type: "file", path: p, staged: true });
			ok++;
		}).catch(function (e) { toast("读取失败：" + e.message); }).then(step);
	})();
}
function saveAlbumInfo() {
	var d = AL_STATE.d; if (!d) return;
	var src = AL_STATE.info || {}, E = AL_STATE.edit || {};
	var out = {};
	Object.keys(src).forEach(function (k) { out[k] = src[k]; });
	["title", "description", "date", "location", "tags", "password", "passwordHint", "cover"].forEach(function (k) {
		if (E.hasOwnProperty(k)) out[k] = E[k];
	});
	if (E.hidden === true) out.hidden = true; else delete out.hidden;
	if (out.tags && (!Array.isArray(out.tags) || !out.tags.length)) delete out.tags;
	if (!out.password) { delete out.password; delete out.passwordHint; delete out.encrypted; }
	else out.encrypted = true;
	if (!out.location) delete out.location;
	if (typeof out.title !== "string" || !out.title.trim()) out.title = d.name;
	if (!out.date) out.date = today();
	if (typeof out.description !== "string") out.description = out.description == null ? "" : String(out.description);

	if (AL_STATE.mode === "external") {
		out.mode = "external";
		var ta = $("#alPhotosText");
		var lines = (ta ? ta.value : "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
		var oldBySrc = {};
		(Array.isArray(src.photos) ? src.photos : []).forEach(function (p) { if (p && p.src) oldBySrc[p.src] = p; });
		out.photos = lines.map(function (u) {
			var o = oldBySrc[u] || {};
			return { src: u, alt: o.alt || "" };
		});
		if (!out.cover) out.cover = lines[0] || "";
		if (!out.cover) delete out.cover;
	} else {
		delete out.mode; delete out.photos;
		if (!out.cover || /^https?:\/\//i.test(out.cover)) delete out.cover;
	}
	var text = JSON.stringify(out, null, 2) + "\n";
	stagePut(d.path + "/info.json", text, "相册 " + (out.title || d.name));
	AL_STATE.info = out;
}
function deleteAlbum() {
	var d = AL_STATE.d; if (!d) return;
	if (!confirm("删除整个相册「" + d.name + "」？\n（含 info.json 与所有图片，先入暂存区，推送后生效）")) return;
	AL_STATE.files.forEach(function (f) { stageDelete(f.path, d.name); });
	stageDelete(d.path + "/info.json", d.name);
	AL_STATE.files = []; AL_STATE.info = {}; AL_STATE.edit = {};
	toast("已暂存删除整个相册，推送后生效");
	loadView("albums", true);
}
function createAlbum() {
	var name = prompt("新相册名称（同时作为文件夹名 / 线上 URL 路径）：", "");
	if (name == null) return;
	name = safeName(name);
	if (!name) { toast("名称不能为空或含非法字符"); return; }
	var info = { title: name, description: "", date: today(), location: "", tags: [], layout: "Grid", columns: 3 };
	stagePut("content/images/albums/" + name + "/info.json", JSON.stringify(info, null, 2) + "\n", "新建相册 " + name);
	stagePut("content/images/albums/" + name + "/.gitkeep", "", "新建相册占位");
	toast("新相册已进暂存区：现在上传封面 / 图片，再统一推送");
	loadView("albums", true);
}

/* ================= 笔记本（书架） ================= */
/* 三本书的数据源都在同一个内容仓文件 content/data/notebooks.ts：
   校园杂记 campusNotebook / 自律日记 runNotebook / 每日碎碎念 dailyNotebook */
var NB_BOOKS = [
	{ key: "campus", color: "#7aa585", lock: "🔒", ttl: "校园杂记", sub: "高中三年，值得留个档", tag1: "Markdown 日记", schema: "notebooks", varName: "campusNotebook", kind: "md" },
	{ key: "run", color: "#e0996b", lock: "📖", ttl: "自律日记", sub: "跑过的路，一步都不白费", tag1: "跑步记录", schema: "notebooksRun", varName: "runNotebook", kind: "run" },
	{ key: "daily", color: "#7d93c4", lock: "📖", ttl: "每日碎碎念", sub: "今天也在认真碎碎念", tag1: "短文本", schema: "notebooksDaily", varName: "dailyNotebook", kind: "text" },
];
var NB_CUR = "campus";
function nbBook(key) { for (var i = 0; i < NB_BOOKS.length; i++) { if (NB_BOOKS[i].key === key) return NB_BOOKS[i]; } return NB_BOOKS[0]; }
function nbSchema(b) { return window.getSchema(b.schema); }
function nbSortKey(b) { return b.kind === "md" ? "h" : "date"; }
/* 每条记录的字段定义（kind → 表单 + 列表展示） */
function nbFields(b) {
	if (b.kind === "run") return [
		{ k: "date", l: "日期", t: "date", req: true },
		{ k: "distance", l: "距离（km）", t: "number", req: true, ph: "如 3.5" },
		{ k: "duration", l: "用时（mm:ss）", t: "text", req: true, ph: "如 28:30" },
		{ k: "heartRate", l: "平均心率", t: "number", ph: "可留空" },
	];
	if (b.kind === "text") return [
		{ k: "date", l: "日期", t: "date", req: true },
		{ k: "content", l: "内容", t: "textarea", req: true },
	];
	return [
		{ k: "h", l: "日期", t: "date", req: true },
		{ k: "body", l: "正文（Markdown）", t: "textarea", req: true },
	];
}
function nbEmptyItem(b) {
	var it = {}; it[nbSortKey(b)] = today(); return it;
}
function nbRowTitle(b, it) {
	if (b.kind === "run") return (it.date || "") + (it.distance != null && it.distance !== "" ? " · " + it.distance + " km" : "");
	if (b.kind === "text") return it.date || "";
	return it.h || "";
}
function nbRowSub(b, it) {
	if (b.kind === "run") return "用时 " + (it.duration || "--") + (it.heartRate ? " · 心率 " + it.heartRate : "");
	if (b.kind === "text") return String(it.content || "").slice(0, 20);
	var body = String(it.body || "");
	return body.slice(0, 18) + (body.length > 18 ? "…" : "");
}
function nbRowRight(b, it) {
	if (b.kind === "run") return it.distance != null && it.distance !== "" ? String(it.distance) : "";
	if (b.kind === "text") return String(it.content || "").length + " 字";
	return String(it.body || "").length + " 字";
}
/* 统一落盘：replace 对应 varName → 清缓存 → 入暂存区 → 重渲染 */
/* 三本书共用一个文件：若该文件已在暂存区（尚未推送），必须以「暂存区内容」为基准改，
   否则用远端原始文本覆盖会把上一本刚暂存的改动抹掉。 */
function tsRawFor(sch) {
	var st = STAGED[sch.path];
	if (st && typeof st.content === "string" && !st.del) return Promise.resolve({ raw: st.content, sha: null });
	return getTs(sch);
}
function nbSaveList(b, list, label) {
	var sch = nbSchema(b);
	return tsRawFor(sch).then(function (ts) {
		var content = TSIO.replace(ts.raw, b.varName, list);
		if (content == null) throw new Error("无法写入 " + sch.path + " 的数据段（" + b.varName + "）");
		clearTs(sch);
		DIRTY = false;
		stagePut(sch.path, content, label || b.ttl);
		loadView("notebooks", true);
	});
}
function renderNotebooks() {
	var v = $("#v-notebooks");
	v.innerHTML = pageHead("note", "笔记本", '线上 <span class="mono">/notebooks/</span> 是一排书架 · <b>3 本</b> · 数据都取自 <span class="mono">content/data/notebooks.ts</span>',
		'<button class="btn" type="button" id="nbImport">⬆ 批量导入 .md</button><button class="btn btn-primary" type="button" id="nbAdd">+ 新增一条</button>') +
		'<div class="nb-src"><span class="pill info">数据源</span><span><b>校园杂记</b> → <span class="mono">campusNotebook</span></span><span class="nb-src-sep"></span><span><b>自律日记</b> → <span class="mono">runNotebook</span></span><span class="nb-src-sep"></span><span><b>每日碎碎念</b> → <span class="mono">dailyNotebook</span></span><span class="nb-src-sep"></span><span>都在 <span class="mono">content/data/notebooks.ts</span> · <b style="color:var(--ok)">三本都可编辑保存</b></span></div>' +
		'<div class="nb-drop" id="nbDrop" data-nb-drop><b>把 .md / .markdown 文件拖到这里批量导入校园杂记</b><br>也支持一次选多个文件 —— 自动读 frontmatter 的 <span class="mono">date / title</span>，没有就取文件修改日期；导入后进暂存区，统一推送上线。</div>' +
		'<div class="shelf" id="nbShelf"></div>' +
		'<div class="split"><div class="card split-list"><div class="card-head" style="padding:10px 12px"><span class="card-title" id="nbTocTitle">校园杂记 · 目录</span><span class="card-sub" style="margin-left:auto" id="nbTocSub"></span></div>' +
		'<div id="nbToc"><div class="empty-block">加载中…</div></div></div><div id="nbPane"><div class="card"><div class="card-body"><div class="empty-block">从左侧选择一条</div></div></div></div></div>';

	/* 批量导入 .md（仅校园杂记；选文件 + 拖拽落区高亮，真正的 drop 由全局 initGlobalDnd 派发） */
	var nbImport = $("#nbImport");
	if (nbImport) nbImport.addEventListener("click", function () {
		var inp = document.createElement("input");
		inp.type = "file"; inp.accept = ".md,.markdown,.txt"; inp.multiple = true;
		inp.onchange = function () { importNotebookMd(Array.prototype.slice.call(inp.files)); };
		inp.click();
	});
	var nbDrop = $("#nbDrop");
	if (nbDrop) {
		["dragenter", "dragover"].forEach(function (ev) {
			nbDrop.addEventListener(ev, function (e) { if (hasFiles(e)) { e.preventDefault(); nbDrop.classList.add("on"); } });
		});
		["dragleave", "dragend", "drop"].forEach(function (ev) {
			nbDrop.addEventListener(ev, function () { nbDrop.classList.remove("on"); });
		});
	}

	var shelf = $("#nbShelf");
	NB_BOOKS.forEach(function (b) {
		var card = el("button", "book-card" + (b.key === NB_CUR ? " on" : ""));
		card.type = "button";
		card.setAttribute("data-book", b.key);
		card.style.setProperty("--bk", b.color);
		card.innerHTML = '<span class="bk-band"></span><span class="bk-top"><span>YuJing Library</span><span>' + b.lock + '</span></span>' +
			'<span class="bk-main"><span class="bk-ttl">' + b.ttl + '</span><span class="bk-bandtx">' + b.sub + '</span></span>' +
			'<span class="bk-foot"><span class="bk-author">余京◎著</span></span>' +
			'<span class="bk-tags"><span class="pill" style="padding:0 6px">' + b.tag1 + '</span><span class="num" id="nbCnt-' + b.key + '">…</span></span>';
		card.addEventListener("click", function () {
			$$("#nbShelf .book-card").forEach(function (x) { x.classList.remove("on"); });
			card.classList.add("on");
			NB_CUR = b.key;
			renderNbToc(b);
		});
		shelf.appendChild(card);
	});
	$("#nbAdd").addEventListener("click", function () {
		var b = nbBook(NB_CUR);
		openNbItem(b, [], nbEmptyItem(b), -1);
	});
	renderNbToc(nbBook(NB_CUR));
}
function renderNbToc(b) {
	var sch = nbSchema(b);
	$("#nbTocTitle").textContent = b.ttl + " · 目录";
	$("#nbToc").innerHTML = '<div class="empty-block">加载中…</div>';
	getTs(sch).then(function (ts) {
		var arr = Array.isArray(ts.value) ? ts.value.slice() : [];
		var sk = nbSortKey(b);
		arr.sort(function (a, c) { return String(c[sk] || "").localeCompare(String(a[sk] || "")); });
		var cnt = $("#nbCnt-" + b.key);
		if (cnt) cnt.textContent = arr.length + " 条";
		$("#nbTocSub").textContent = arr.length + " 条 · 倒序";
		var box = $("#nbToc");
		box.innerHTML = "";
		arr.forEach(function (it, i) {
			var row = el("div", "list-item" + (i === 0 ? " on" : ""));
			row.setAttribute("data-sel", "");
			row.innerHTML = '<div class="list-thumb" style="background:var(--bg-inset);font-size:11px">' + pad(arr.length - i) + '</div><div class="list-main"><div class="list-t">' + esc(nbRowTitle(b, it)) + '</div><div class="list-s">' + esc(nbRowSub(b, it)) + '</div></div><div class="list-r num" style="font-size:11px">' + esc(nbRowRight(b, it)) + '</div>';
			row.addEventListener("click", function () { openNbItem(b, arr, it, i); });
			box.appendChild(row);
		});
		if (!arr.length) box.innerHTML = '<div class="empty-block">还没有记录，点「+ 新增一条」</div>';
	}).catch(function (e) { $("#nbToc").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
}
function openNbItem(b, arr, it, idx) {
	var isNew = idx < 0;
	var defs = nbFields(b);
	$$("#nbToc .list-item").forEach(function (x) { x.classList.remove("on"); });
	var fields = defs.map(function (d) {
		var val = it[d.k] == null ? "" : it[d.k];
		var inp;
		if (d.t === "textarea") inp = '<textarea class="inp mono ed-area" id="nbf-' + d.k + '" style="min-height:200px;font-size:12.5px">' + esc(val) + '</textarea>';
		else if (d.t === "date") inp = '<input class="inp" type="date" id="nbf-' + d.k + '" value="' + esc(val) + '">';
		else if (d.t === "number") inp = '<input class="inp" type="number" step="0.01" id="nbf-' + d.k + '" value="' + esc(val) + '" placeholder="' + (d.ph || "") + '">';
		else inp = '<input class="inp" type="text" id="nbf-' + d.k + '" value="' + esc(val) + '" placeholder="' + (d.ph || "") + '">';
		return '<div class="f' + (d.t === "textarea" ? " wide" : "") + '"><label class="f-label">' + d.l + (d.req ? '<span class="req">*</span>' : "") + '</label>' + inp + '</div>';
	}).join("");
	$("#nbPane").innerHTML = '<div class="card"><div class="card-head"><h2 class="card-title">' + b.ttl + '</h2><span class="pill">' + b.tag1 + '</span></div>' +
		'<div class="card-body"><div class="form-grid">' + fields + '</div>' +
		'<div class="f-hint" style="margin-top:10px">写入 <span class="mono">content/data/notebooks.ts</span> 的 <span class="mono">' + b.varName + '</span> 数组</div></div></div>' +
		'<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" type="button" id="nbSave">💾 存入暂存区</button><div style="flex:1"></div>' + (isNew ? "" : '<button class="btn btn-danger" type="button" id="nbDel">🗑 删除这条</button>') + '</div>';
	$("#nbSave").addEventListener("click", function () {
		var item = {}, miss = [];
		defs.forEach(function (d) {
			var raw = $("#nbf-" + d.k).value;
			if (d.t === "number") { if (raw !== "") item[d.k] = Number(raw); }
			else item[d.k] = raw;
			if (d.req && (item[d.k] === undefined || item[d.k] === "")) miss.push(d.l);
		});
		if (miss.length) { toast("请填写：" + miss.join("、")); return; }
		var list = arr.slice();
		if (isNew) list.push(item); else list[idx] = item;
		var sk = nbSortKey(b);
		list.sort(function (a, c) { return String(a[sk] || "").localeCompare(String(c[sk] || "")); });
		nbSaveList(b, list, b.ttl);
	});
	var del = $("#nbDel");
	if (del) del.addEventListener("click", function () {
		if (!confirm("删除这条？（先入暂存区）")) return;
		nbSaveList(b, arr.filter(function (x) { return x !== it; }), b.ttl + "（删除一条）");
	});
}
function ymdOf(ts) {
	var d = new Date(ts);
	if (isNaN(d.getTime())) return "";
	return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
/**
 * 批量导入 .md → 校园杂记（campusNotebook）
 * 每篇 = { h: 日期, body: Markdown }：
 *   日期优先 frontmatter 的 date / published / h，其次文件最后修改时间，最后今天
 *   正文若 frontmatter 有 title 且正文开头不是标题，自动补一行 "# 标题"
 */
function importNotebookMd(files) {
	var list = (files || []).filter(isMdFile);
	if (!list.length) { toast("没有可导入的 .md / .markdown 文件"); return; }
	var sch = window.getSchema("notebooks");
	tsRawFor(sch).then(function (ts) {
		var base = Array.isArray(ts.value) ? ts.value.slice() : [];
		var added = [], i = 0, skip = 0;
		function step() {
			if (i >= list.length) return finish();
			var f = list[i++];
			readTextFile(f).then(function (txt) {
				var p = MDM.parse(txt);
				var fm = p.data || {};
				var h = String(fm.date || fm.published || fm.h || "").trim().slice(0, 10);
				if (!/^\d{4}-\d{2}-\d{2}$/.test(h)) h = ymdOf(f.lastModified) || today();
				var body = String(p.body || "").replace(/^\s+|\s+$/g, "");
				var title = fm.title ? String(fm.title).trim() : "";
				if (title && !/^#{1,6}\s/.test(body)) body = "# " + title + (body ? "\n\n" + body : "");
				if (!body) { skip++; return; }
				added.push({ h: h, body: body });
			}).catch(function () { skip++; }).then(step);
		}
		function finish() {
			if (!added.length) { toast("没有解析到有效内容" + (skip ? "（跳过 " + skip + " 个空文件）" : "")); return; }
			var arr = base.concat(added);
			arr.sort(function (a, b) { return String(a.h || "").localeCompare(String(b.h || "")); });
			var content = TSIO.replace(ts.raw, "campusNotebook", arr);
			clearTs(sch);
			DIRTY = false;
			stagePut(sch.path, content, "校园杂记（批量导入 " + added.length + " 篇）");
			toast("已暂存 " + added.length + " 篇" + (skip ? "，跳过 " + skip + " 个空文件" : "") + "，点「统一推送」上线");
			loadView("notebooks", true);
		}
		step();
	}).catch(function (e) { toast("读取 notebook 数据失败：" + e.message); });
}

/* ================= 站点与外观（settings · tabs + 递归折叠表单） ================= */
var SETTINGS_FILES = ["site", "hero", "navbar", "footer", "profile", "comment", "music", "wallpaper", "license"];
/* tab 文案用中文（文件名叫什么可以 hover 看 title，表单底部也印了「回写位置」） */
var SETTINGS_TAB_CN = {
	site: "站点身份", hero: "首屏", navbar: "导航菜单", footer: "页脚", profile: "个人资料",
	comment: "评论", music: "音乐", wallpaper: "壁纸", license: "许可协议",
};
var SETTINGS_LOADED = {};
/** 内容仓里的真实写法是 `const site: SiteSettings = {…}; export default site;`，
 *  变量名是**小写 camelCase**（site / hero / navbar …），根本不是 `SiteConfig`。
 *  早先这里只按文件名硬拼 `XxxConfig`，于是 9 个配置文件全部报「无法解析」。 */
function settingsVarCandidates(file) {
	var cap = file.charAt(0).toUpperCase() + file.slice(1);
	return [file, cap + "Settings", cap + "Config", cap];
}
/** 解析 settings 源文件的数据段 → { val, mode, varName }（varName=null 表示只读、无法回写）
 *  依次尝试：① 候选变量名（TSIO 支持 `const x = {…}` / `export const x = {…}`）
 *            ② `export default <标识符>;` → 去抽那个标识符的 const
 *            ③ `export default { … };` 内联字面量（只能读） */
function resolveSettingsSource(raw, file) {
	if (typeof raw !== "string" || !raw) return null;
	var cands = settingsVarCandidates(file);
	for (var i = 0; i < cands.length; i++) {
		var v = TSIO.extract(raw, cands[i]);
		if (v && typeof v === "object") return { val: v, varName: cands[i], mode: "var" };
	}
	var m = raw.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/);
	if (m) {
		var dv = TSIO.extract(raw, m[1]);
		if (dv && typeof dv === "object") return { val: dv, varName: m[1], mode: "var" };
	}
	m = raw.match(/export\s+default\s*(\{[\s\S]*\})\s*;?\s*$/);
	if (m) {
		try {
			var lv = new Function("return (" + m[1] + ");")();
			if (lv && typeof lv === "object") return { val: lv, varName: null, mode: "default-literal" };
		} catch (e) { /* 落到调用方统一报错 */ }
	}
	return null;
}
function renderSettings() {
	var v = $("#v-settings");
	v.innerHTML = pageHead("sys", "站点与外观", '<span class="mono">content/settings/</span> · 9 个文件 · 最深 4 层 → 递归折叠表单') +
		'<div class="card"><div class="tabs" style="padding:0 8px">' +
		SETTINGS_FILES.map(function (f, i) { return '<button class="tab' + (i === 0 ? " on" : "") + '" data-tab="s-' + f + '" title="content/settings/' + f + '.ts">' + esc(SETTINGS_TAB_CN[f] || f) + '</button>'; }).join("") +
		'</div><div class="card-body" id="setBody"><div class="empty-block">加载中…</div></div></div>';
	$$('#v-settings .tab').forEach(function (b) {
		b.addEventListener("click", function () {
			$$('#v-settings .tab').forEach(function (x) { x.classList.remove("on"); });
			b.classList.add("on");
			var f = b.getAttribute("data-tab").slice(2);
			showSettingsTab(f);
		});
	});
	showSettingsTab("site");
}
function showSettingsTab(file) {
	var body = $("#setBody");
	if (SETTINGS_LOADED[file]) { renderSettingsBody(file); return; }
	body.innerHTML = '<div class="empty-block">加载 ' + file + '.ts …</div>';
	GIT.getFile(OWNER, REPO, "content/settings/" + file + ".ts", BRANCH).then(function (f) {
		if (!f) { body.innerHTML = '<div class="error-block">settings/' + file + '.ts 不存在</div>'; return; }
		var r = resolveSettingsSource(f.content, file);
		if (!r) {
			body.innerHTML = '<div class="error-block">无法解析 settings/' + esc(file) + '.ts 的数据段' +
				'<br><span class="f-hint">已尝试：' + esc(settingsVarCandidates(file).join(" / ")) + '、export default &lt;标识符&gt;、export default {…}</span></div>';
			return;
		}
		SETTINGS_LOADED[file] = { raw: f.content, sha: f.sha, val: r.val, mode: r.mode, varName: r.varName };
		renderSettingsBody(file);
	}).catch(function (e) { body.innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
}
function renderSettingsBody(file) {
	var ctx = SETTINGS_LOADED[file];
	var body = $("#setBody");
	if (!ctx || !body) return;
	var html = '<div id="setForm">' + settingsFormHtml(file, ctx.val, "") + '</div>';
	if (ctx.varName) {
		html += '<div class="f-hint" style="margin-top:10px">回写位置：<span class="mono">' + esc(file) + '.ts</span> → <span class="mono">' + esc(ctx.varName) + '</span>' +
			'（只替换数据段，注释 / interface / import 一字不动）</div>';
		html += '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-primary" type="button" id="setSave">💾 存入暂存区（' + esc(file) + '.ts）</button></div>';
	} else {
		html += '<div class="f-hint" style="margin-top:10px">该文件是 <span class="mono">export default {…}</span> 内联字面量写法，没有可安全回写的变量名，这里只读。</div>';
	}
	body.innerHTML = html;
	bindSettingsFields(file);
	var sb = $("#setSave");
	if (sb) sb.addEventListener("click", function () {
		var content = TSIO.replace(ctx.raw, ctx.varName, ctx.val);
		if (!content) { toast("回写失败：在 " + file + ".ts 里找不到 " + ctx.varName + " 的数据段"); return; }
		DIRTY = false;
		stagePut("content/settings/" + file + ".ts", content, "站点与外观 · " + file);
		toast("已暂存：" + file + ".ts");
	});
}
/* ============ 「站点与外观」字段中文名 / 说明 ============
   键 = 归一化路径（数组下标写成 []，如 links[].url）；整条路径取不到就退到「最后一段键名」。
   值 = [中文名, 说明?, 可选项数组?]（说明与可选项可省；给了可选项就渲染成下拉框，防手抖拼错）。
   措辞沿用 preview/editor-preview.html 那版已签收的中文化稿。
   注意：原始 key 仍以小灰标（.f-key）保留在中文名后面，方便对着 content/settings/*.ts 核对。 */
var SETTINGS_CN = {
	site: {
		title: ["站点标题", "浏览器标签、SEO、页脚显示的站点名"],
		subtitle: ["副标题 / 一句话简介"],
		siteURL: ["站点网址", "必须带尾斜杠，如 https://yujingblog.top/"],
		siteStartDate: ["建站日期", "主页「已运行 N 天」由它推算"],
		themeColorHue: ["主题色相", "0–360：红=0 · 青=200 · 蓝绿=250 · 粉=345"],
		navbarTitle: ["顶栏标题"],
		"navbarTitle.mode": ["显示模式", "text-icon = 图标 + 文字；logo = 只显示 Logo", ["text-icon", "logo"]],
		"navbarTitle.text": ["顶栏文字"],
		"navbarTitle.icon": ["顶栏图标路径", "相对 public/，不要以 / 开头"],
		"navbarTitle.logo": ["站点 Logo 路径", "同上，相对 public/"],
	},
	hero: {
		enable: ["启用首屏", "关掉则首页直接进内容"],
		images: ["背景图", "可写多张（每行一张），脚本随机挑一张；留空则用纯纸张底。路径是站点根绝对路径（以 / 开头）"],
		mobileImage: ["移动端也用背景图", "这是个开关（不是图片路径）；关掉则手机端走纯纸底"],
		imageOverlay: ["背景图上下遮罩", "两个 0~1 的数，分别对应 [上, 下]，控制图片上下渐变变暗的程度"],
		noteText: ["便签贴纸文字", "用反斜杠 n 换行"],
		stickers: ["图片贴纸", "最多 5 张"],
		"stickers[].image": ["贴纸图片"],
		"stickers[].link": ["点击跳转", "可选，留空即不可点"],
		"stickers[].alt": ["替代文本", "可选，无障碍读屏用"],
		"stickers[].size": ["显示尺寸", "单位 px"],
		stickersDraggable: ["贴纸可拖拽", "允许访客拖动首屏上的贴纸"],
		ctaText: ["下拉纸签文案"],
	},
	navbar: {
		links: ["菜单项", "最多一层嵌套：children[] 与父级同构递归"],
		"links[].name": ["菜单文字"],
		"links[].url": ["跳转地址", "站内写 /xxx/，站外写完整 https://"],
		"links[].external": ["站外链接", "勾上会加 target=_blank 并显示外链图标"],
		"links[].icon": ["图标名", "Iconify 名称，如 lucide:house"],
		"links[].children": ["子菜单"],
		"links[].children[].name": ["子项文字"],
		"links[].children[].url": ["子项地址"],
		brandMenu: ["品牌菜单", "顶栏最左侧那组（当前放的是「编辑器」入口）"],
	},
	footer: {
		enable: ["启用自定义页脚", "开启后可用 HTML 覆盖主题自带页脚（当前是关闭状态）"],
		customHtml: ["页脚 HTML", "例如备案号。留空则使用默认页脚"],
	},
	profile: {
		avatar: ["头像"],
		name: ["显示名称", "侧边栏名片与首屏社交区都用它"],
		bio: ["一句话签名"],
		typewriter: ["打字机效果"],
		"typewriter.enable": ["启用打字机", "签名逐字打出来的效果"],
		"typewriter.speed": ["打字速度", "单位毫秒，越小越快"],
		links: ["社交链接"],
		"links[].name": ["名称"],
		"links[].icon": ["图标", "Iconify 名称；写错不会报错，只是图标不显示"],
		"links[].url": ["链接"],
	},
	comment: {
		enable: ["启用评论", "关掉则文章页不渲染评论区"],
		system: ["评论后端", "本站固定 Twikoo（Waline 组件已删除，切不回去了）", ["twikoo"]],
		envId: ["云函数地址", "含 https://，不带路径。留空则留言墙显示加载失败，但页面本身不报错"],
		lang: ["界面语言", "注意是短横线的 zh-CN，不是下划线的 zh_CN"],
		avatarFallback: ["头像兜底图", "访客头像加载失败时显示这张"],
	},
	music: {
		enable: ["启用播放器"],
		showFloatingPlayer: ["显示悬浮播放器", "右下角那个能一直播放的小球"],
		floatingEntryMode: ["悬浮入口模式", "fab = 并入右下角通用按钮组；default = 独立悬浮球", ["fab", "default"]],
		metingApi: ["Meting API 地址", "地址里的 :server / :type / :id 会被下面几项替换进去"],
		playlistId: ["歌单 ID", "换歌单只改这一个值"],
		server: ["音乐源", "网易云 / QQ音乐 / 酷狗 / 虾米 / 百度", ["netease", "tencent", "kugou", "xiami", "baidu"]],
		playlistType: ["清单类型", "一般是 playlist"],
	},
	wallpaper: {
		enable: ["启用全屏壁纸"],
		desktop: ["桌面端壁纸", "可写多张做轮播（每行一张）"],
		mobile: ["移动端壁纸", "可写多张做轮播（每行一张）"],
		position: ["对齐位置", "等同于 CSS object-position，只支持这三个值", ["top", "center", "bottom"]],
		carousel: ["轮播"],
		"carousel.enable": ["启用轮播"],
		"carousel.interval": ["轮播间隔", "单位秒"],
		zIndex: ["层级", "负数才会待在内容下面"],
		opacity: ["壁纸不透明度", "0~1"],
		blur: ["背景模糊半径", "单位 px，数值越大越糊"],
		switchable: ["允许访客切换壁纸"],
		overlay: ["纸张与卡片"],
		"overlay.opacity": ["纸张不透明度", "壁纸上那层「纸」的浓度"],
		"overlay.cardOpacity": ["卡片不透明度"],
		overlaySwitchable: ["允许访客改纸张项"],
		"overlaySwitchable.opacity": ["纸张不透明度"],
		"overlaySwitchable.blur": ["模糊半径"],
		"overlaySwitchable.cardOpacity": ["卡片不透明度"],
		fullscreenSwitchable: ["全屏模式可调整项"],
		"fullscreenSwitchable.opacity": ["不透明度"],
		"fullscreenSwitchable.blur": ["模糊半径"],
	},
	license: {
		enable: ["显示许可协议"],
		name: ["协议名称", "文章 frontmatter 没写 licenseName 时用这个兜底"],
		url: ["协议链接", "当前为空。CC 示例：https://creativecommons.org/licenses/by-nc-sa/4.0/"],
	},
};
function normSettingPath(p) { return String(p).replace(/\.\d+\./g, "[].").replace(/\.\d+$/, "[]"); }
function settingsCn(file, path) {
	var t = SETTINGS_CN[file];
	if (!t) return null;
	var np = normSettingPath(path);
	if (t[np]) return t[np];
	return t[String(path).split(".").pop()] || null;
}
function settingsLabel(file, path, fallback) {
	var c = settingsCn(file, path);
	return c ? c[0] : (fallback == null ? String(path).split(".").pop() : fallback);
}
/** 中文名 + 原始 key 小灰标（extra 可再挂一个后缀，如「每行一项」） */
function settingsLabHtml(file, key, fk, extra) {
	var c = settingsCn(file, fk);
	return '<label class="f-label">' + esc(c ? c[0] : key) + ' <span class="f-key">' + esc(fk) + '</span>' + (extra || '') + '</label>';
}
function settingsHintHtml(file, fk) {
	var c = settingsCn(file, fk);
	return c && c[1] ? '<div class="f-hint">' + esc(c[1]) + '</div>' : "";
}
function settingsFoldHtml(file, key, fk, meta, inner) {
	return '<details class="fold" style="margin-top:14px"><summary><svg class="arw" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>' +
		esc(settingsLabel(file, fk, key)) + ' <span class="f-key">' + esc(fk) + '</span>' +
		(meta ? '<span class="fold-meta">' + esc(meta) + '</span>' : '') +
		'</summary><div class="fold-body">' + inner + '</div></details>';
}
function settingsFormHtml(file, obj, prefix) {
	var h = '<div class="form-grid">';
	Object.keys(obj).forEach(function (k) {
		var val = obj[k];
		var fk = prefix + k;
		if (val && typeof val === "object" && !Array.isArray(val)) return; /* 折叠区单独渲染 */
		/* 数组：空数组、对象数组都交给下面折叠区 —— 别用单行 input 承接，
		   否则「一行字符串」会被写回数组位置，把元素类型写坏。 */
		if (Array.isArray(val) && (val.length === 0 || (val[0] && typeof val[0] === "object"))) return;
		h += settingsFieldHtml(file, k, fk, val);
	});
	h += '</div>';
	Object.keys(obj).forEach(function (k) {
		var val = obj[k];
		var fk = prefix + k;
		if (val && typeof val === "object" && !Array.isArray(val)) {
			h += settingsFoldHtml(file, k, fk, '', settingsFormHtml(file, val, fk + "."));
		} else if (Array.isArray(val) && (val.length === 0 || (val[0] && typeof val[0] === "object"))) {
			var inner = '';
			if (!val.length) {
				inner += '<div class="f-hint">目前是空数组。空数组没有元素可以推断类型，编辑器不在这里新增项（避免写成字符串数组）；要加内容请在 GitHub 上直接改。</div>';
			}
			val.forEach(function (item, i) {
				inner += '<div class="block"><div class="block-head" style="display:flex;gap:10px;align-items:center"><span>⠿</span>' +
					esc(settingsLabel(file, fk, k)) + ' #' + (i + 1) +
					' <span class="f-key">' + esc(fk) + '[' + i + ']</span><div style="flex:1"></div></div>' +
					'<div class="card-body">' + settingsFormHtml(file, item, fk + "." + i + ".") + '</div></div>';
			});
			h += settingsFoldHtml(file, k, fk, val.length ? '数组 · ' + val.length + ' 项' : '空数组', inner);
		}
	});
	return h;
}
function settingsFieldHtml(file, key, fk, val) {
	var cs = settingsCn(file, fk);
	var hint = settingsHintHtml(file, fk);
	/* 字典里给了可选项 → 下拉框（比手打安全，避免拼错值） */
	if (cs && cs[2] && typeof val === "string") {
		var opts = cs[2].slice();
		if (opts.indexOf(val) < 0) opts.unshift(val);
		return '<div class="f">' + settingsLabHtml(file, key, fk) + '<select class="inp" data-sk="' + esc(fk) + '">' +
			opts.map(function (o) { return '<option value="' + esc(o) + '"' + (o === val ? " selected" : "") + '>' + esc(o) + '</option>'; }).join("") +
			'</select>' + hint + '</div>';
	}
	var type = typeof val;
	/* 原始类型数组（images / desktop / mobile / imageOverlay …）：
	   单行 input 装不下，改成一行的 textarea，回读时按行拆回数组并保留元素类型。 */
	if (Array.isArray(val)) {
		var rows = Math.min(8, Math.max(2, val.length || 2));
		var isNum = val.length > 0 && val.every(function (x) { return typeof x === "number"; });
		return '<div class="f wide">' + settingsLabHtml(file, key, fk, '<span class="fold-meta">每行一项' + (isNum ? ' · 数字' : '') + '</span>') +
			'<textarea class="inp" rows="' + rows + '" data-sk="' + esc(fk) + '" data-skind="arr"' + (isNum ? ' data-snum="1"' : '') + '>' + esc(val.join("\n")) + '</textarea>' + hint + '</div>';
	}
	if (type === "boolean") {
		return '<div class="f">' + settingsLabHtml(file, key, fk) + '<label class="sw"><input type="checkbox" data-sk="' + esc(fk) + '"' + (val ? " checked" : "") + '><i></i></label>' + hint + '</div>';
	}
	if (type === "number") {
		return '<div class="f">' + settingsLabHtml(file, key, fk) + '<input class="inp num" type="number" data-sk="' + esc(fk) + '" value="' + esc(val) + '">' + hint + '</div>';
	}
	if (type === "string" && /\/|https?:/.test(val) && String(val).length > 3) {
		return '<div class="f wide">' + settingsLabHtml(file, key, fk) + '<input class="inp mono" data-sk="' + esc(fk) + '" value="' + esc(val) + '">' + hint + '</div>';
	}
	if (type === "string" && String(val).length > 40) {
		return '<div class="f wide">' + settingsLabHtml(file, key, fk) + '<textarea class="inp" rows="2" data-sk="' + esc(fk) + '">' + esc(val) + '</textarea>' + hint + '</div>';
	}
	return '<div class="f">' + settingsLabHtml(file, key, fk) + '<input class="inp" data-sk="' + esc(fk) + '" value="' + esc(val == null ? "" : val) + '">' + hint + '</div>';
}
function bindSettingsFields(file) {
	var ctx = SETTINGS_LOADED[file];
	if (!ctx) return;
	$$('#setBody [data-sk]').forEach(function (inp) {
		if (inp.dataset.sbound) return;
		inp.dataset.sbound = "1";
		var path = inp.getAttribute("data-sk").split(".");
		/* <select> 用 change（部分浏览器不派发 input），其余文本类用 input */
		var ev = (inp.type === "checkbox" || inp.tagName === "SELECT") ? "change" : "input";
		inp.addEventListener(ev, function () {
			var obj = ctx.val;
			for (var i = 0; i < path.length - 1; i++) obj = obj[path[i]];
			var k = path[path.length - 1];
			if (inp.type === "checkbox") {
				obj[k] = inp.checked;
			} else if (inp.dataset.skind === "arr") {
				/* 数组：一行一项 → 保持原元素类型（数字数组仍写数字），空行丢弃 */
				var lines = inp.value.split("\n").map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });
				obj[k] = inp.dataset.snum === "1"
					? lines.map(Number).filter(function (n) { return !isNaN(n); })
					: lines;
			} else if (inp.classList.contains("num")) {
				obj[k] = Number(inp.value);
			} else {
				obj[k] = inp.value;
			}
			DIRTY = true;
		});
	});
}


/* ================= 仪表盘 ================= */
function loading(text) { return '<div class="loading-block"><span class="spin"></span>' + (text || "加载中…") + "</div>"; }
/* ================= 骨架屏（加载占位） =================
   比「转圈 + 加载中」更接近最终布局：加载完成时高度不跳、也不留空白卡片。 */
function skLine(w, h) { return '<i class="sk" style="width:' + w + '%;height:' + (h || 12) + 'px"></i>'; }
function skDonutCard() {
	var rows = "";
	for (var i = 0; i < 3; i++) {
		rows += '<li class="don-item"><i class="don-dot sk" style="border-radius:3px"></i>'
			+ '<i class="sk" style="flex:1 1 auto;height:12px"></i>'
			+ '<i class="sk" style="flex:0 0 52px;height:12px"></i>'
			+ '<i class="sk" style="flex:0 0 34px;height:12px"></i></li>';
	}
	return '<div class="card don-card"><div class="card-head"><h2 class="card-title">站点储存分布</h2>' +
		'<span class="card-sub" style="margin-left:auto">正在统计两个仓库…</span></div>' +
		'<div class="card-body don-body"><div class="sk sk-ring"></div><ul class="don-legend">' + rows + '</ul></div></div>';
}
function skTrend() {
	var hs = [34, 58, 44, 76, 52, 88, 46, 68, 40, 62, 50, 72];
	return '<div class="sk-chart">' + hs.map(function (v) {
		return '<i class="sk" style="flex:1 1 0;height:' + v + '%"></i>';
	}).join("") + "</div>";
}
function skList(n) {
	var out = "";
	for (var i = 0; i < (n || 3); i++) {
		out += '<div class="sk-row">' + skLine(56 + ((i * 9) % 32), 12) + skLine(30 + ((i * 7) % 24), 9) + "</div>";
	}
	return '<div class="sk-list">' + out + "</div>";
}
function kpiFrame(key, icon, tint, k, act) {
	return '<div class="card kpi' + (act ? " kpi-act" : "") + '"' + (act ? ' data-kpi="' + key + '" role="button" tabindex="0"' : "") + ">" +
		'<div class="kpi-ic ' + tint + '">' + icon + "</div>" +
		'<div class="kpi-bd"><div class="kpi-k">' + k + '</div><div class="kpi-v num" id="kpi-' + key + '">…</div>' +
		'<div class="kpi-d" id="kpid-' + key + '"></div>' +
		(act ? '<div class="kpi-go">' + (key === "post" ? "点击新建 / 拖入 .md" : "点击新建动态") + "</div>" : "") +
		"</div></div>";
}
function trendChartHtml(series) {
	/* 结构 1:1 对齐预览稿仪表盘趋势图：虚线网格(y=8/83/158) + 渐变面积 + 描线 + HTML 定位圆点 */
	var vals = series.map(function (x) { return x.pageviews || x.y || 0; });
	var dates = series.map(function (x) { return String(x.x || x.date || ""); });
	var n = vals.length;
	var max = Math.max.apply(null, vals.concat([1]));
	var W = 660, TOP = 8, BOT = 158, span = BOT - TOP;
	function y(v) { return BOT - (v / max) * span; }
	var step = n > 1 ? W / (n - 1) : W;
	var line = vals.map(function (v, i) { return (i === 0 ? "M" : "L") + (i * step).toFixed(1) + "," + y(v).toFixed(1); }).join(" ");
	var area = line + " L" + W + "," + BOT + " L0," + BOT + " Z";
	var peakI = 0; vals.forEach(function (v, i) { if (v > vals[peakI]) peakI = i; });
	var px = peakI * step, py = y(vals[peakI]);
	var total = vals.reduce(function (a, b) { return a + b; }, 0);
	function pct(yv) { return (yv / 170 * 100).toFixed(2) + "%"; }
	function pctx(xv) { return (xv / W * 100).toFixed(2) + "%"; }
	var dots = vals.map(function (v, i) {
		return '<i class="pt-dot" style="left:' + pctx(i * step) + ';top:' + pct(y(v)) + '" title="' + esc(dates[i].slice(5)) + ' · ' + v + '"></i>';
	}).join("");
	return '<div class="chart-wrap"><div class="chart-yaxis">' +
		'<span style="top:' + Math.round(TOP * 148 / 170) + 'px">' + max + "</span>" +
		'<span style="top:' + Math.round((TOP + span / 2) * 148 / 170) + 'px">' + Math.round(max / 2) + "</span>" +
		'<span style="top:' + Math.round(BOT * 148 / 170) + 'px">0</span></div>' +
		'<div class="chart" style="height:148px"><div class="chart-area">' +
		'<svg viewBox="0 0 ' + W + ' 170" preserveAspectRatio="none" role="img" aria-label="近 30 天逐日浏览量趋势">' +
		'<defs><linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">' +
		'<stop offset="0" stop-color="var(--accent)" stop-opacity=".30"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>' +
		"</linearGradient></defs>" +
		'<line x1="0" y1="' + TOP + '" x2="' + W + '" y2="' + TOP + '" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>' +
		'<line x1="0" y1="' + (TOP + span / 2) + '" x2="' + W + '" y2="' + (TOP + span / 2) + '" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>' +
		'<line x1="0" y1="' + BOT + '" x2="' + W + '" y2="' + BOT + '" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
		'<line x1="' + px.toFixed(1) + '" y1="' + TOP + '" x2="' + px.toFixed(1) + '" y2="' + BOT + '" stroke="var(--accent)" stroke-width="1" stroke-dasharray="4 4" opacity=".55" vector-effect="non-scaling-stroke"/>' +
		'<path d="' + area + '" fill="url(#dashArea)"/>' +
		'<path d="' + line + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
		"</svg>" +
		'<i class="cm-dot" style="left:' + pctx(px) + ";top:" + pct(py) + '"></i>' +
		'<span class="cm-lb" style="left:' + pctx(px) + ";top:" + pct(py) + '">峰值 ' + esc(dates[peakI].slice(5)) + " · " + vals[peakI] + "</span>" +
		dots +
		"</div></div></div>" +
		'<div class="chart-xaxis">' + (function () {
			var out = [];
			for (var k = 0; k < 6; k++) {
				var idx = Math.round(k * (n - 1) / 5);
				out.push("<span>" + esc(dates[idx].slice(5)) + "</span>");
			}
			return out.join("");
		})() + "</div>" +
		'<div class="chart-foot">近 ' + n + " 天 · 合计 <b class=\"num\">" + total.toLocaleString() + "</b> 次浏览 · 峰值 <b class=\"num\">" + vals[peakI] + "</b>（" + esc(dates[peakI].slice(5)) + "）</div>";
}
function donutHtml(id) {
	return '<div class="card don-card" id="' + id + '"><div class="card-head"><h2 class="card-title">站点储存分布</h2><span class="card-sub" style="margin-left:auto">内容仓 + 站点仓 · 点仓库 / 目录可下钻</span></div>' +
		'<div class="card-body don-body" data-donut>' +
		'<div class="donut"><svg viewBox="0 0 150 150"><g transform="rotate(-90 75 75)"></g></svg><div class="don-center"></div></div>' +
		'<ul class="don-legend"></ul>' +
		'<div class="don-crumb" hidden><span class="don-crumb-tx"></span><button class="btn btn-sm" type="button" data-don-back>返回总览</button></div>' +
		"</div></div>";
}
var DON_PAL = ["var(--tint-purple-fg)", "var(--tint-green-fg)", "var(--tint-blue-fg)", "var(--tint-orange-fg)", "#a98ac4", "#4f9ea8", "#c48a9a", "#8aa88f"];
function donutDraw(root, node, crumb) {
	var C = 2 * Math.PI * 54;
	var kids = node.children || [];
	var tot = node.bytes || kids.reduce(function (a, c) { return a + c.bytes; }, 0) || 0;
	root.__tree = node;
	/* __tree = 当前层级；__root = 总览树（「返回总览」直接重画，不再整页重渲染）；
	   __crumb = 当前层级 id（点叶子兜底时用来「留在本层」而不误清面包屑） */
	root.__crumb = crumb || null;
	if (!crumb) root.__root = node;
	/* __tree 同时挂在 data-donut 容器与卡片上（下钻处理器从 [data-donut] 起查） */
	var anchor = (root.matches && root.matches("[data-donut]")) ? root : (root.querySelector ? root.querySelector("[data-donut]") : null);
	if (anchor) { anchor.__tree = node; anchor.__crumb = crumb || null; if (!crumb) anchor.__root = node; }
	var card = root.closest ? root.closest(".don-card") : null;
	if (card) { card.__tree = node; card.__crumb = crumb || null; if (!crumb) card.__root = node; }
	var svg = root.querySelector(".donut svg g");
	var center = root.querySelector(".don-center");
	var legend = root.querySelector(".don-legend");
	var bar = root.querySelector(".don-crumb");
	if (!svg || !center || !legend) return;
	var off = 0, arcs = "";
	kids.forEach(function (c, i) {
		var drill = !!(c.children && c.children.length);   /* 叶子不下钻 → 不会点进空白 */
		var ratio = tot ? c.bytes / tot : 0;
		var len = ratio * C;
		arcs += '<circle cx="75" cy="75" r="54" fill="none" stroke="' + DON_PAL[i % DON_PAL.length] + '" stroke-width="15"'
			+ ' stroke-dasharray="' + len.toFixed(2) + " " + (C - len).toFixed(2) + '"'
			+ ' stroke-dashoffset="' + (-off).toFixed(2) + '"'
			+ (drill ? ' data-drill="' + esc(c.id) + '" style="cursor:pointer"' : "")
			+ '><title>' + esc(c.nm) + " " + fmtBytes(c.bytes) + " / " + (ratio * 100).toFixed(1) + '%</title></circle>';
		off += ratio * C;
	});
	/* 全 0 字节 / 无子项：给一圈浅色底环，避免「一片空白」看不出是空还是没加载 */
	svg.innerHTML = arcs || '<circle cx="75" cy="75" r="54" fill="none" stroke="var(--line)" stroke-width="15"/>';
	center.innerHTML = '<b class="num">' + (tot / 1048576).toFixed(1) + '</b><span>' + (crumb ? "MB · 该分类" : "MB 合计") + '</span>';
	var lg = "";
	kids.forEach(function (c, i) {
		var drill = !!(c.children && c.children.length);
		var ratio = tot ? c.bytes / tot : 0;
		lg += '<li class="don-item' + (drill ? "" : " don-leaf") + '"' + (drill ? ' data-drill="' + esc(c.id) + '" title="点击下钻"' : ' title="该分类下没有更细的划分"') + '>'
			+ '<i class="don-dot" style="background:' + DON_PAL[i % DON_PAL.length] + '"></i>'
			+ '<span class="don-nm">' + esc(c.nm) + '</span>'
			+ '<span class="don-sz num">' + fmtBytes(c.bytes) + '</span>'
			+ '<span class="don-pc num">' + (ratio * 100).toFixed(1) + '%</span></li>';
	});
	if (!kids.length) lg = '<li class="don-empty">该分类下没有更细的划分</li>';
	legend.innerHTML = lg;
	if (bar) {
		bar.hidden = false;
		bar.style.visibility = crumb ? "visible" : "hidden";
		if (crumb) bar.querySelector(".don-crumb-tx").textContent = "当前：" + node.nm + (node.files ? "（" + node.files + " 个文件）" : "");
	}
}
/* ============ 储存分布：内容仓 + 站点仓 合并成一棵可下钻的树 ============ */
var DON_MAX_DEPTH = 4, DON_MAX_KIDS = 8;
/* 过滤：隐藏项（.github/ .obsidian/ .gitignore …）与说明文件（README / LICENSE …）不进分布。
   这两类既不是内容也不是代码，体积恒为 0，混在图例里只会占行还把「下钻」引到空页面。 */
function donSkipName(nm) {
	return /^\./.test(nm) ||
		/^(readme|license|licence|copying|changelog|contributing|code_of_conduct)(\.[a-z0-9]+)?$/i.test(nm);
}
function donItems(tree) {
	/* GitHub tree → [{rel, size}]（任一目录段命中过滤则整条跳过） */
	var out = [];
	((tree && tree.tree) || []).forEach(function (t) {
		if (t.type !== "blob") return;
		var parts = String(t.path || "").split("/");
		for (var i = 0; i < parts.length; i++) { if (donSkipName(parts[i])) return; }
		out.push({ rel: parts.join("/"), size: t.size || 0 });
	});
	return out;
}
/* 递归成树。children 为空 = 叶子 → 不给下钻入口，杜绝「点进去一片空白」 */
function donNode(items, name, depth) {
	var groups = {}, bytes = 0, files = 0;
	items.forEach(function (it) {
		bytes += it.size; files++;
		var p = it.rel.split("/");
		var seg = p[0], isDir = p.length > 1;
		var g = groups[seg] || (groups[seg] = { nm: seg, dir: isDir, bytes: 0, files: 0, items: [] });
		g.bytes += it.size; g.files++;
		if (isDir) g.items.push({ rel: p.slice(1).join("/"), size: it.size });
	});
	var kids = Object.keys(groups).map(function (k) {
		var g = groups[k];
		var children = (g.dir && depth < DON_MAX_DEPTH) ? donNode(g.items, g.nm, depth + 1).children : [];
		return { nm: g.nm + (g.dir ? "/" : ""), bytes: g.bytes, files: g.files, children: children };
	}).sort(function (a, b) { return b.bytes - a.bytes; });
	return { nm: name, bytes: bytes, files: files, children: donCap(kids) };
}
function donCap(kids) {
	if (kids.length <= DON_MAX_KIDS) return kids;
	var take = DON_MAX_KIDS - 1;
	var top = kids.slice(0, take), rest = kids.slice(take), b = 0, f = 0;
	rest.forEach(function (c) { b += c.bytes; f += c.files; });
	top.push({ nm: "其他 " + rest.length + " 项", bytes: b, files: f, children: [] });
	return top;
}
function donIdAssign(n, prefix) {
	n.id = prefix;
	(n.children || []).forEach(function (c) { donIdAssign(c, prefix + "/" + String(c.nm).replace(/\/+$/, "")); });
	return n;
}
var DON_REPOS = [{ tag: "content", nm: "内容仓库" }, { tag: "site", nm: "站点仓库" }];
function treeToDonut(trees) {
	/* 两仓一起看总占用：一级 = 仓库 → 二级/三级 = 目录 → 叶子 = 文件 */
	var repos = [], total = 0;
	DON_REPOS.forEach(function (r) {
		var items = donItems(trees && trees[r.tag]);
		if (!items.length) return;
		var n = donNode(items, r.nm, 1);
		n.repo = r.tag;
		repos.push(n); total += n.bytes;
	});
	repos.sort(function (a, b) { return b.bytes - a.bytes; });
	var root = { nm: "全部储存", bytes: total, children: repos };
	root.children.forEach(function (c) { donIdAssign(c, "r:" + c.repo); });
	return root;
}
function cmtItemHtml(c) {
	var src = String(c.url || "").replace(/^https?:\/\/[^/]+/, "") || "/";
	var viewId = src.indexOf("/posts/") === 0 ? "posts" : src.indexOf("/friends") === 0 ? "friends" : src.indexOf("/about") === 0 ? "about" : src.indexOf("/diary") === 0 || src.indexOf("/life") === 0 ? "diary" : "";
	return '<div class="cmt-item"' + (viewId ? ' data-view="' + viewId + '"' : "") + ' title="点击跳转到该评论所在的页面">' +
		'<img class="cmt-avatar" src="' + esc(c.avatar || (TWIKOO_URL + "/avatar/default")) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
		'<div class="cmt-main"><div class="cmt-top"><span class="cmt-nm">' + esc(c.nick || "匿名") + '</span><span class="cmt-time">' + timeAgo(Number(c.created) || 0) + '</span></div>' +
		'<div class="cmt-txt">' + esc(String(c.comment || "").replace(/<[^>]+>/g, "").slice(0, 120)) + '</div>' +
		'<div class="cmt-src">评论于《' + esc(src) + '》</div></div></div>';
}
function commitRowHtml(c) {
	var d = new Date((c.commit.committer || c.commit.author || {}).date);
	var msg = String(c.commit.message || "").split("\n")[0];
	var sha = String(c.sha || "").slice(0, 7);
	return '<div class="row"><div class="row-k"><div class="list-t">' + esc(msg) + '</div><div class="list-s mono">' + sha + " · " + (isNaN(d) ? "" : d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })) + '</div></div></div>';
}
function renderDash() {
	setView("dash",
		'<div class="page-head greet"><div><h1 class="page-title greet-title">欢迎回来，YuJing <span class="greet-emoji">👋</span></h1><p class="page-desc">今天是分享知识的好时光。</p></div>' +
		'<div class="page-actions"><span class="muted2" style="font-size:12px">数据实时拉取 · ' + today() + '</span><button class="btn btn-icon" type="button" id="dashRefresh" title="刷新数据">' + svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>') + '</button></div></div>' +
		'<div class="stat-row">' +
		kpiFrame("post", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h11l5 5v11H4z"/><path d="M15 4v5h5"/><path d="M8.5 13h7M8.5 16.5h4.5"/></svg>', "kpi-purple", "文章总数", true) +
		kpiFrame("diary", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/></svg>', "kpi-green", "动态条数", true) +
		kpiFrame("friend", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.1 2.1a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>', "kpi-blue", "友链总数") +
		kpiFrame("cmt", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.8-.4L3 21l1.5-4.4A8.4 8.4 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4h.6a8.4 8.4 0 0 1 8.4 8.4z"/></svg>', "kpi-orange", "评论总数") +
		"</div>" +
		'<div class="dash-top">' +
		'<div class="card"><div class="card-head"><h2 class="card-title">站点流量统计</h2><span class="card-sub" style="margin-left:auto">近 31 天 · Umami 分享 API</span></div><div class="card-body trend-body" id="dashTrend">' + skTrend() + '</div></div>' +
		'<div id="dashDonut">' + skDonutCard() + "</div></div>" +
		'<div class="dash-2col" style="margin-top:14px"><div><div class="card"><div class="card-head"><h2 class="card-title">最新评论</h2><button class="cmt-all" type="button" id="cmtAllBtn">查看全部</button></div><div class="cmt-list" id="dashCmts">' + skList(4) + '</div></div></div>' +
		'<div><div class="card"><div class="card-head"><h2 class="card-title">最近提交</h2><button class="cmt-all" type="button" id="depAllBtn" title="打开 Vercel 构建历史">查看全部</button></div><div id="dashCommits">' + skList(3) + '</div></div></div></div>');
	$("#dashRefresh").addEventListener("click", function () { CACHE.posts = null; CACHE.comments = null; Object.keys(CACHE).forEach(function (k) { if (k.indexOf("ts:") === 0) delete CACHE[k]; }); renderDash(); });
	$("#cmtAllBtn").addEventListener("click", function () { go("comments"); });
	$("#depAllBtn").addEventListener("click", function () { window.open("https://vercel.com/yujing/~/deployments", "_blank", "noopener"); });
	/* .md / 图片拖拽统一由全局处理器接管（initGlobalDnd） */
	var jobs = [
		withTimeout(loadPostsWithMeta(), 20000),
		withTimeout(getTs(window.getSchema("diary")), 10000),
		withTimeout(getTs(window.getSchema("friends")), 10000),
		withTimeout(twikooRecent(), 8000),
		withTimeout(umami("/pageviews", "startAt=" + (Date.now() - 31 * 86400000) + "&endAt=" + Date.now() + "&unit=day&timezone=Asia%2FShanghai"), 8000),
		withTimeout(ghTree(REPO), 12000),
		withTimeout(ghTree(SITE_REPO, SITE_BRANCH), 15000),
		withTimeout(ghCommits(REPO, 3), 8000),
	];
	Promise.all(jobs).then(function (rs) {
		var posts = rs[0], diary = rs[1], friends = rs[2], comments = rs[3], pv = rs[4], tree = rs[5], siteTree = rs[6], commits = rs[7];
		var el1 = $("#kpi-post"), el2 = $("#kpi-diary"), el3 = $("#kpi-friend"), el4 = $("#kpi-cmt");
		if (!el1) return;
		if (posts) {
			var postNew = posts.filter(function (p) { var t = Date.parse(p.fm.published || "") || 0; return t >= MONTH_START; }).length;
			el1.textContent = posts.length;
			$("#kpid-post").innerHTML = postNew > 0 ? '<b class="kpi-num">+' + postNew + "</b> 本月新增" : "本月无新增";
			$("#kpid-post").className = "kpi-d " + (postNew > 0 ? "up" : "zero");
		}
		if (diary && Array.isArray(diary.value)) {
			var dNew = diary.value.filter(function (d) { var t = Date.parse(d.date || "") || 0; return t >= MONTH_START; }).length;
			el2.textContent = diary.value.length;
			$("#kpid-diary").innerHTML = dNew > 0 ? '<b class="kpi-num">+' + dNew + "</b> 本月新增" : "本月无新增";
			$("#kpid-diary").className = "kpi-d " + (dNew > 0 ? "up" : "zero");
		}
		if (friends && Array.isArray(friends.value)) { el3.textContent = friends.value.length; $("#kpid-friend").textContent = "稳定运行中"; }
		if (comments) {
			var cNew = comments.filter(function (c) { return c.created >= MONTH_START; }).length;
			el4.textContent = comments.length;
			$("#kpid-cmt").innerHTML = cNew > 0 ? '<b class="kpi-num">+' + cNew + "</b> 本月新增" : "本月无新增";
			$("#kpid-cmt").className = "kpi-d " + (cNew > 0 ? "up" : "zero");
		}
		if (pv && pv.pageviews && pv.pageviews.length) $("#dashTrend").innerHTML = trendChartHtml(pv.pageviews.slice(-31));
		else $("#dashTrend").innerHTML = '<div class="empty-block">暂无流量数据</div>';
		if (tree || siteTree) {
			/* 两个仓库合成一张环形图；某一个拉失败也能照常显示另一个 */
			var node = treeToDonut({ content: tree, site: siteTree });
			$("#dashDonut").innerHTML = donutHtml("dashDonutCard");
			donutDraw($("#dashDonutCard"), node, null);
		} else $("#dashDonut").innerHTML = '<div class="card"><div class="card-body"><div class="empty-block">储存统计不可用</div></div></div>';
		if (comments) {
			var cl = $("#dashCmts");
			cl.innerHTML = comments.slice(0, 4).map(cmtItemHtml).join("") || '<div class="empty-block">暂无评论</div>';
		}
		if (commits) $("#dashCommits").innerHTML = commits.map(commitRowHtml).join("") || '<div class="empty-block">暂无提交</div>';
	});
}
/* 仪表盘交互：KPI 点击 / 下钻 / 评论跳转（事件委托） */
document.addEventListener("click", function (e) {
	var k = e.target.closest(".kpi-act");
	if (k && current === "dash") {
		if (k.getAttribute("data-kpi") === "post") go("posts");
		else go("diary");
		return;
	}
	var back = e.target.closest("[data-don-back]");
	if (back) {
		/* 直接重画总览树（不再整页重渲染 → 不会闪骨架、也不重新拉接口） */
		var box = back.closest("[data-donut]");
		if (box && box.__root) donutDraw(box, box.__root, null);
		return;
	}
	var d = e.target.closest("[data-drill]");
	if (d) {
		var root = d.closest("[data-donut]");
		if (root && root.__tree) {
			var id = d.getAttribute("data-drill");
			var hit = null;
			(root.__tree.children || []).forEach(function (c) { if (c.id === id || c.nm === id) hit = c; });
			if (hit && hit.children && hit.children.length) donutDraw(root, hit, id);
			else donutDraw(root, root.__tree, root.__crumb || null);   /* 叶子兜底：留在当前层，不画空图 */
		}
		return;
	}
	var row = e.target.closest("[data-view]");
	if (row && row.closest(".cmt-list")) {
		var v = row.getAttribute("data-view");
		if (v && document.getElementById("v-" + v) && confirm("跳转到该评论所在的页面？")) go(v);
	}
});

/* ================= 发布状态 ================= */
function renderRelease() {
	setView("release",
		pageHead("up", "发布状态", 'GitHub commit status + Vercel · 内容仓推送后自动触发站点构建',
			'<button class="btn" type="button" id="relRefresh">↻ 刷新</button><button class="btn btn-primary" type="button" id="relSyncBtn">打开站点构建</button><button class="btn btn-primary" type="button" id="relVercel">打开 Vercel 构建历史</button>') +
		'<div class="stat-row">' +
		'<div class="card stat"><div class="stat-k">当前状态</div><div class="stat-v" style="font-size:20px;color:var(--ok)" id="relState">检测中…</div><div class="stat-f">Vercel · Production</div></div>' +
		'<div class="card stat"><div class="stat-k">站点仓最新提交</div><div class="stat-v mono" style="font-size:17px" id="relSiteSha">…</div><div class="stat-f">yujingblog-site · main</div></div>' +
		'<div class="card stat"><div class="stat-k">内容仓最新提交</div><div class="stat-v mono" style="font-size:17px" id="relSha">…</div><div class="stat-f">yujingblog-content · master</div></div>' +
		'<div class="card stat"><div class="stat-k">内容同步</div><div class="stat-v" style="font-size:17px" id="relSync">检测中…</div><div class="stat-f" id="relSyncF">已同步到站点</div></div>' +
		'<div class="card stat"><div class="stat-k">暂存区</div><div class="stat-v" style="font-size:20px" id="relStage">0 项</div><div class="stat-f">待统一推送</div></div></div>' +
		'<div class="card"><div class="card-head"><h2 class="card-title">内容仓最近提交</h2></div><div id="relList">' + loading() + '</div></div>' +
		'<div class="card"><div class="card-head"><h2 class="card-title">站点仓最近提交</h2></div><div id="relSiteList">' + loading() + "</div></div>");
	$("#relVercel").addEventListener("click", function () { window.open("https://vercel.com/yujing/~/deployments", "_blank", "noopener"); });
	$("#relRefresh").addEventListener("click", function () { renderRelease(); });
	$("#relSyncBtn").addEventListener("click", function () {
		window.open("https://github.com/yujing0208/yujingblog-site/actions", "_blank", "noopener");
	});
	ghCommits(REPO, 8).then(function (cs) {
		$("#relSha").textContent = cs.length ? String(cs[0].sha).slice(0, 7) : "—";
		$("#relList").innerHTML = cs.map(commitRowHtml).join("") || '<div class="empty-block">暂无提交</div>';
	}).catch(function (e) { $("#relList").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
	ghCommits(SITE_REPO, 8, SITE_BRANCH).then(function (cs) {
		$("#relSiteSha").textContent = cs.length ? String(cs[0].sha).slice(0, 7) : "—";
		$("#relState").textContent = "已上线";
		$("#relSiteList").innerHTML = cs.map(commitRowHtml).join("") || '<div class="empty-block">暂无提交</div>';
	}).catch(function (e) { $("#relSiteList").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });

	// 内容同步状态：内容仓 HEAD 与站点仓记录的 content-sha.txt 是否一致
	var syncEl = $("#relSync"), syncF = $("#relSyncF");
	Promise.all([
		ghCommits(REPO, 1).catch(function () { return []; }),
		GIT.getFile(OWNER, SITE_REPO, "content-sha.txt", SITE_BRANCH).catch(function () { return null; }),
	]).then(function (r) {
		if (!syncEl) return;
		var cs = r[0] || [];
		var head = cs.length ? String(cs[0].sha) : "";
		var rec = ((r[1] && r[1].content) || "").trim();
		if (!head) { syncEl.textContent = "—"; if (syncF) syncF.textContent = "取不到内容仓 HEAD"; return; }
		if (rec === head) {
			syncEl.textContent = "已同步";
			syncEl.style.color = "var(--ok)";
			if (syncF) syncF.textContent = "站点已构建 @ " + head.slice(0, 7);
		} else {
			syncEl.textContent = "待同步";
			syncEl.style.color = "#d9822b";
			if (syncF) syncF.textContent = "内容 " + head.slice(0, 7) + " / 站点 " + (rec ? rec.slice(0, 7) : "无记录");
		}
	}).catch(function () { if (syncEl) syncEl.textContent = "检测失败"; });
}

/* ================= CF 图床 ================= */
function renderCfbed() {
	setView("cfbed",
		pageHead("cloudimg", "CF 图床", '<span class="mono">img.yujingblog.top</span> · CloudFlare-ImgBed · 服务端代理，前端零 token',
			'<button class="btn btn-primary" type="button" id="cfUp">⬆ 上传图片</button>') +
		'<div class="split" data-panes style="grid-template-columns:250px minmax(0,1fr)">' +
		'<div class="card" style="padding:10px"><div class="block" style="border:0"><div class="block-head" style="background:transparent;border:0;padding:4px 8px 6px">排序</div>' +
		'<div class="seg" style="display:flex;width:100%"><button class="on" style="flex:1 1 0" type="button" data-cfsort="date">最新</button><button style="flex:1 1 0" type="button" data-cfsort="name">名称</button><button style="flex:1 1 0" type="button" data-cfsort="size">大小</button></div></div>' +
		'<div class="hr" style="margin:10px 0"></div>' +
		'<div class="f" style="padding:0 8px"><label class="f-label">每页数量 <span class="muted2 mono">?count=</span></label><select class="inp" id="cfCount"><option>12</option><option selected>24</option><option>48</option></select></div></div>' +
		'<div><div class="card"><div class="card-head"><h2 class="card-title">图床文件</h2><span class="card-sub" style="margin-left:auto" id="cfSub"></span></div>' +
		'<div class="toolbar" style="padding:11px 14px;border-bottom:1px solid var(--line-soft)"><input class="inp" id="cfSearch" placeholder="搜索文件名…" style="flex:1 1 190px;max-width:290px"><div style="flex:1"></div><button class="btn btn-sm" type="button" id="cfRefresh">↻ 刷新列表</button></div>' +
		'<div class="card-body"><div class="grid-img" id="cfGrid">' + loading() + '</div></div>' +
		'<div class="toolbar" style="padding:11px 14px;border-top:1px solid var(--line-soft)"><span class="f-hint" id="cfPageInfo"></span><div style="flex:1"></div><button class="btn btn-sm" type="button" id="cfPrev">← 上一页</button><button class="btn btn-sm" type="button" id="cfNext">下一页 →</button></div>' +
		"</div></div></div>");
	var CF = { page: 1, count: 24, sort: "date", q: "" };
	function loadList() {
		$("#cfGrid").innerHTML = loading();
		fetch("/api/imgbed?op=list&start=" + ((CF.page - 1) * CF.count) + "&count=" + CF.count, { credentials: "same-origin" })
			.then(function (r) { return r.json(); })
			.then(function (j) {
				var files = j.files || [];
				if (CF.q) files = files.filter(function (f) { return String(f.name || "").toLowerCase().indexOf(CF.q) >= 0; });
				if (CF.sort === "name") files.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
				if (CF.sort === "size") files.sort(function (a, b) { return (b.size || 0) - (a.size || 0); });
				if (CF.sort === "date") files.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
				var tot = j.total != null ? j.total : j.totalCount;
				$("#cfSub").textContent = tot != null ? "共 " + tot + " 个" : "";
				$("#cfPageInfo").textContent = "第 " + CF.page + " 页";
				/* 缩略图：.ph 用 background-size:cover 铺满（不再只露左上角）；
				   点卡片任意处 → 灯箱看「完整」大图（contain），复制外链在灯箱底部 */
				$("#cfGrid").innerHTML = files.length ? files.map(function (f) {
					var u = f.url || "", nm = String(f.name || "");
					return '<div class="thumb" data-sel data-url="' + esc(u) + '" data-imgprev="' + esc(u) + '" data-name="' + esc(nm) + '" title="点击看大图 / 复制外链">' +
						'<div class="ph" style="background-image:url(\'' + esc(u) + '\')"></div>' +
						'<div class="cap">' + esc(nm.slice(0, 26)) + '</div>' +
						'<div class="thumb-meta"><span class="num">' + fmtBytes(f.size) + '</span></div></div>';
				}).join("") : '<div class="empty-block">没有文件</div>';
			})
			.catch(function (e) { $("#cfGrid").innerHTML = '<div class="error-block">' + esc(e.message) + "（需在 Vercel 配置 CFBED_TOKEN）</div>"; });
	}
	function promptImgUse(url) {
		if (!url) return;
		var use = prompt("图片直链：\n" + url + "\n\n1 = 复制 Markdown  2 = 复制 HTML  其他 = 复制直链", "1");
		if (use === null) return;
		var text = use === "1" ? "![](" + url + ")" : use === "2" ? '<img src="' + url + '">' : url;
		if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast("已复制"); });
	}
	$("#cfUp").addEventListener("click", function () {
		var inp = document.createElement("input");
		inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
		inp.onchange = function () {
			var fs = Array.prototype.slice.call(inp.files); if (!fs.length) return;
			var done = 0, fail = 0, next = function () {
				if (!fs.length) { toast("上传完成：成功 " + done + "，失败 " + fail); loadList(); return; }
				var f = fs.shift();
				uploadToImgbed(f).then(function () { done++; }).catch(function () { fail++; }).finally(next);
			};
			next();
		};
		inp.click();
	});
	$("#cfRefresh").addEventListener("click", loadList);
	$("#cfSearch").addEventListener("input", function () { CF.q = this.value.trim().toLowerCase(); CF.page = 1; loadList(); });
	$("#cfPrev").addEventListener("click", function () { if (CF.page > 1) { CF.page--; loadList(); } });
	$("#cfNext").addEventListener("click", function () { CF.page++; loadList(); });
	$$("#v-cfbed [data-cfsort]").forEach(function (b) {
		b.addEventListener("click", function () {
			$$("#v-cfbed [data-cfsort]").forEach(function (x) { x.classList.remove("on"); });
			b.classList.add("on");
			CF.sort = b.getAttribute("data-cfsort");
			loadList();
		});
	});
	$("#cfCount").addEventListener("change", function () { CF.count = Number(this.value); CF.page = 1; loadList(); });
	loadList();
}

/* ================= 全部评论 ================= */
function renderComments() {
	setView("comments",
		pageHead("comment", "全部评论", 'Twikoo · 点击评论可跳转到对应管理页',
			'<button class="btn" type="button" id="cmtRefresh">↻ 刷新</button>') +
		'<div class="card"><div class="cmt-list" id="cmtFull">' + loading() + "</div></div>");
	$("#cmtRefresh").addEventListener("click", function () { CACHE.comments = null; renderComments(); });
	twikooRecent().then(function (list) {
		$("#cmtFull").innerHTML = list.length ? list.map(cmtItemHtml).join("") : '<div class="empty-block">暂无评论</div>';
	}).catch(function (e) {
		$("#cmtFull").innerHTML = '<div class="error-block">评论加载失败：' + esc(e.message) + "</div>";
	});
}

/* ================= 网站统计 ================= */
var ST_CMTS = [];       /* 最近一次拉到的评论，仅用于渲染分布 */
var ST_DIST = "page";   /* 评论分布维度：page | month | user */
function cmtDistRows(cmts, mode) {
	var map = {};
	cmts.forEach(function (c) {
		var k;
		if (mode === "month") {
			var d = new Date(Number(c.created) || 0);
			k = isNaN(d.getTime()) ? "（未知）" : d.getFullYear() + "-" + pad(d.getMonth() + 1);
		} else if (mode === "user") {
			k = (c.nick && String(c.nick).trim()) || "匿名";
		} else {
			k = String(c.url || "").replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "") || "/";
		}
		map[k] = (map[k] || 0) + 1;
	});
	var rows = Object.keys(map).map(function (k) { return { k: k, v: map[k] }; });
	rows.sort(function (a, b) { return mode === "month" ? b.k.localeCompare(a.k) : (b.v - a.v) || a.k.localeCompare(b.k); });
	return rows;
}
function renderCmtDist() {
	var box = $("#stCmtDist");
	if (!box) return;
	var rows = cmtDistRows(ST_CMTS, ST_DIST);
	if (!rows.length) { box.innerHTML = '<div class="empty-block">还没有评论数据</div>'; return; }
	var total = ST_CMTS.length || 1;
	var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
	var shown = rows.slice(0, 12);
	box.innerHTML = shown.map(function (r, i) {
		return '<div class="rank-row"><span class="rank-i num">' + (i + 1) + '</span><div class="rank-k"><div class="rank-t">' + esc(r.k) + '</div><div class="rank-bar"><i style="width:' + (r.v / max * 100).toFixed(1) + '%"></i></div></div><span class="rank-v num">' + r.v + '</span><span class="rank-p num">' + (r.v / total * 100).toFixed(1) + '%</span></div>';
	}).join("") + (rows.length > shown.length ? '<div class="rank-row" style="color:var(--ink-4);font-size:12px"><span class="rank-i"></span><div class="rank-k">还有 ' + (rows.length - shown.length) + ' 组未展示</div></div>' : "");
}
function renderStats() {
	setView("stats",
		pageHead("chart", "网站统计", 'Umami（浏览量 / 访问 / 游客 + 文章排行）· Twikoo（评论）· 实时拉取',
			'<button class="btn" type="button" id="stRefresh">↻ 刷新</button>') +
		'<div class="stat-row" id="stRow">' + loading() + "</div>" +
		'<div class="card" style="margin-top:14px"><div class="card-head"><h2 class="card-title">文章阅读量排行</h2><span class="pill info">GET /metrics?type=title</span></div>' +
		'<div data-ranklist id="stRank">' + loading() + "</div></div>" +
		'<div class="card" style="margin-top:14px"><div class="card-head"><h2 class="card-title">评论分布</h2>' +
		'<div class="tabs" style="margin-left:auto;border-bottom:0"><button class="tab on" type="button" data-cdist="page">按页面</button><button class="tab" type="button" data-cdist="month">按月</button><button class="tab" type="button" data-cdist="user">按评论者</button></div>' +
		'<span class="pill" id="stCmtTotal">—</span></div>' +
		'<div id="stCmtDist">' + loading() + "</div></div>");
	$("#stRefresh").addEventListener("click", function () { renderStats(); });
	$$("#v-stats [data-cdist]").forEach(function (b) {
		b.addEventListener("click", function () {
			ST_DIST = b.getAttribute("data-cdist");
			$$("#v-stats [data-cdist]").forEach(function (x) { x.classList.toggle("on", x === b); });
			renderCmtDist();
		});
	});
	Promise.all([
		withTimeout(umami("/stats", "startAt=" + (Date.now() - 30 * 86400000) + "&endAt=" + Date.now()), 8000),
		withTimeout(umami("/metrics", "startAt=" + (Date.now() - 30 * 86400000) + "&endAt=" + Date.now() + "&type=title"), 8000),
		withTimeout(twikooRecent(), 8000),
	]).then(function (rs) {
		var s = rs[0] || {}, m = rs[1] || {}, cmts = rs[2] || [];
		/* Umami 新版返回扁平数值（pageviews:4744），旧版是 {value}；metrics 可能是裸数组 */
		function uNum(v) { return typeof v === "number" ? v : (v && typeof v.value === "number" ? v.value : null); }
		function fmt(v) { return v != null ? Number(v).toLocaleString() : "—"; }
		var rows = Array.isArray(m) ? m : (m.metrics || m.rows || []);
		$("#stRow").innerHTML =
			'<div class="card stat"><div class="stat-k">浏览量 · 近 30 天</div><div class="stat-v num">' + fmt(uNum(s.pageviews)) + '</div><div class="stat-f">Umami pageviews</div></div>' +
			'<div class="card stat"><div class="stat-k">访问数 · 近 30 天</div><div class="stat-v num">' + fmt(uNum(s.visits)) + '</div><div class="stat-f">visits</div></div>' +
			'<div class="card stat"><div class="stat-k">游客数 · 近 30 天</div><div class="stat-v num">' + fmt(uNum(s.visitors)) + '</div><div class="stat-f">visitors</div></div>' +
			'<div class="card stat"><div class="stat-k">评论总数</div><div class="stat-v num">' + cmts.length + '</div><div class="stat-f">Twikoo · 本月 +' + cmts.filter(function (c) { return c.created >= MONTH_START; }).length + "</div></div>";
		var total = rows.reduce(function (a, r) { return a + (r.y || 0); }, 0) || 1;
		var max = Math.max.apply(null, rows.map(function (r) { return r.y || 0; }).concat([1]));
		$("#stRank").innerHTML = rows.length ? rows.slice(0, 12).map(function (r, i) {
			return '<div class="rank-row"><span class="rank-i num">' + (i + 1) + '</span><div class="rank-k"><div class="rank-t">' + esc(r.x || r.path || r.url || "?") + '</div><div class="rank-bar"><i style="width:' + ((r.y || 0) / max * 100).toFixed(1) + '%"></i></div></div><span class="rank-v num">' + (r.y || 0) + '</span><span class="rank-p num">' + ((r.y || 0) / total * 100).toFixed(1) + '%</span></div>';
		}).join("") : '<div class="empty-block">暂无排行数据</div>';
		ST_CMTS = Array.isArray(cmts) ? cmts : [];
		var tot = $("#stCmtTotal");
		if (tot) tot.textContent = ST_CMTS.length + " 条评论";
		renderCmtDist();
	}).catch(function (e) {
		$("#stRow").innerHTML = '<div class="error-block">' + esc(e.message) + "</div>";
		$("#stRank").innerHTML = "";
		$("#stCmtDist").innerHTML = '<div class="error-block">' + esc(e.message) + "</div>";
	});
}

/* ================= 数据备份 ================= */
function renderBackup() {
	setView("backup",
		pageHead("db", "数据备份", "内容仓 git 历史即备份 · 每月 1 号自动快照 backup/年-月 分支（保留 12 个月）") +
		'<div class="card"><div class="card-head"><h2 class="card-title">自动月度快照</h2><span class="card-sub">GitHub Actions · 每月 1 号 · 保留 12 个月</span></div><div id="bkSnapshots">' + loading() + "</div></div>" +
		'<div class="card"><div class="card-head"><h2 class="card-title">最近提交（可回滚点）</h2><span class="pill warn">建新 commit 指向旧 tree，不改写历史</span></div>' +
		'<div id="bkList">' + loading() + "</div></div>" +
		'<div class="card"><div class="card-head"><h2 class="card-title">Tags</h2><span class="card-sub">发布上线成功后自动打 tag</span></div><div id="bkTags">' + loading() + "</div></div>" +
		'<div class="card"><div class="card-head"><h2 class="card-title">暂存区（未推送）</h2></div><div id="bkDrafts"></div></div>');
	ghCommits(REPO, 10).then(function (cs) {
		$("#bkList").innerHTML = cs.map(function (c) {
			var d = new Date((c.commit.committer || c.commit.author || {}).date);
			return '<div class="row"><div class="row-k"><div class="list-t">' + esc(String(c.commit.message || "").split("\n")[0]) + '</div><div class="list-s mono">' + esc(String(c.sha).slice(0, 8)) + " · " + (isNaN(d) ? "" : d.toLocaleString("zh-CN")) + '</div></div><div class="row-v"><button class="btn btn-sm" type="button" data-rollback="' + esc(c.sha) + '">回滚到此</button></div></div>';
		}).join("") || '<div class="empty-block">暂无提交</div>';
		$$("#bkList [data-rollback]").forEach(function (b) {
			b.addEventListener("click", function () {
				var sha = b.getAttribute("data-rollback");
				if (!confirm("回滚到 " + sha.slice(0, 7) + "？（建新 commit 指向旧 tree，不改写历史）")) return;
				GIT.commitTree(OWNER, REPO, BRANCH, [], "revert(editor): 回滚到 " + sha).then(function () {
					toast("已建回滚 commit");
				}).catch(function (e) { toast("回滚失败：" + e.message); });
			});
		});
	}).catch(function (e) { $("#bkList").innerHTML = '<div class="error-block">' + esc(e.message) + "</div>"; });
	gh("/repos/" + OWNER + "/" + REPO + "/branches?per_page=100").then(function (bs) {
		var snaps = (bs || []).map(function (b) { return b.name || ""; }).filter(function (n) { return n.indexOf("backup/") === 0; }).sort().reverse();
		$("#bkSnapshots").innerHTML = snaps.length ? snaps.map(function (n) {
			return '<div class="row"><div class="row-k mono">' + esc(n) + '</div><div class="row-v"><span class="pill ok">快照</span></div></div>';
		}).join("") : '<div class="empty-block">还没有快照 —— 下个月 1 号自动生成（也可在内容仓 Actions 手动触发）</div>';
	}).catch(function () { $("#bkSnapshots").innerHTML = '<div class="empty-block">快照列表加载失败</div>'; });
	gh("/repos/" + OWNER + "/" + REPO + "/tags?per_page=15").then(function (tags) {
		$("#bkTags").innerHTML = tags.length ? tags.map(function (t) {
			return '<div class="row"><div class="row-k mono">' + esc(t.name) + '</div><div class="row-v"><span class="pill ok">tag</span></div></div>';
		}).join("") : '<div class="empty-block">暂无 tag</div>';
	}).catch(function () { $("#bkTags").innerHTML = '<div class="empty-block">暂无 tag</div>'; });
	renderBkDrafts();
}
function renderBkDrafts() {
	var box = $("#bkDrafts");
	if (!box) return;
	var keys = Object.keys(STAGED);
	box.innerHTML = keys.length ? keys.map(function (k) {
		var it = STAGED[k];
		return '<div class="row"><div class="row-k mono">' + esc(k) + '</div><div class="row-v"><span class="pill info">' + (it.del ? "删除" : "1 项未推送") + '</span> <button class="btn btn-sm" type="button" data-unstage="' + esc(k) + '">撤销</button></div></div>';
	}).join("") : '<div class="empty-block">暂存区是空的</div>';
	$$("#bkDrafts [data-unstage]").forEach(function (b) {
		b.addEventListener("click", function () { unstage(b.getAttribute("data-unstage")); renderBkDrafts(); });
	});
}

/* ================= 启动 ================= */
function boot() {
	applyBlogLook();
	renderNav();
	initGlobalDnd();           /* 拖拽：图片→图床→插入外链；.md→导入 */
	initImagePreviewClicks();  /* 点任意图片 / 图片地址标签 → 大图预览 */
	$("#backSite").addEventListener("click", function () { location.href = "/"; });
	$("#collapseBtn").addEventListener("click", function () {
		if (window.matchMedia("(max-width: 1023px)").matches) {
			document.documentElement.setAttribute("data-side", "expanded");
			document.documentElement.removeAttribute("data-drawer");
			syncSideUI();
			return;
		}
		var cur = document.documentElement.getAttribute("data-side");
		document.documentElement.setAttribute("data-side", cur === "collapsed" ? "expanded" : "collapsed");
		syncSideUI();
	});
	$("#burger").addEventListener("click", function () { document.documentElement.setAttribute("data-drawer", "open"); });
	$("#scrim").addEventListener("click", function () { document.documentElement.removeAttribute("data-drawer"); });
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape") document.documentElement.removeAttribute("data-drawer");
		if (e.key === "Escape") openStage(false);
		if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); var b = $('[data-save]:not([data-topbound])') || $('[data-save]'); if (b) b.click(); }
	});
	$("#nav").addEventListener("click", function (e) {
		if (document.documentElement.getAttribute("data-side") === "collapsed") {
			var hc = e.target.closest(".nav-group-head");
			if (hc) { document.documentElement.setAttribute("data-side", "expanded"); syncSideUI(); return; }
		}
		var h = e.target.closest(".nav-group-head");
		if (h) {
			var box = h.parentNode;
			var on = box.classList.toggle("open");
			h.setAttribute("aria-expanded", on ? "true" : "false");
			NAV_OPEN[box.getAttribute("data-group")] = on; navSave();
			return;
		}
		var b = e.target.closest(".nav-item");
		if (b) go(b.getAttribute("data-go"));
	});
	$("#pushBtn").addEventListener("click", function () { openStage(true); });
	$("#status").addEventListener("click", function () { openStage(true); });
	var spClose = document.querySelector("[data-sp-close]");
	if (spClose) spClose.addEventListener("click", function () { openStage(false); });
	$("#stageMask").addEventListener("click", function () { openStage(false); });
	$("#spPush").addEventListener("click", pushAll);
	/* 窄屏分面板切换（列表/编辑） */
	document.addEventListener("click", function (e) {
		var sw = e.target.closest("[data-mpane]");
		if (sw) {
			var box = sw.closest(".m-switch");
			$$("button", box).forEach(function (x) { x.classList.toggle("on", x === sw); });
			var pane = sw.getAttribute("data-mpane");
			var split = box.parentNode.querySelector("[data-panes]") || document.querySelector("[data-panes]");
			if (split) split.setAttribute("data-show", pane);
			return;
		}
		var pg = e.target.closest("[data-pane-go]");
		if (pg) {
			var pane2 = pg.getAttribute("data-pane-go");
			var msw = document.querySelector(".m-switch");
			if (msw) $$("button", msw).forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-mpane") === pane2); });
			var sp = document.querySelector("[data-panes]");
			if (sp) sp.setAttribute("data-show", pane2);
		}
	});
	var initId = (location.hash.match(/#\/(\w+)/) || [])[1];
	if (!TITLES[initId]) initId = "dash";
	go(initId, true);
	fetch("/api/editor-auth", { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
		if (!(j && j.ok)) { showLogin(); $("#userPill").textContent = "未登录"; }
		else $("#userPill").textContent = j.login || "编辑";
	}).catch(function () { $("#userPill").textContent = "编辑"; });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function() {
	try { boot(); } catch(e) {
		var el = document.getElementById("__errBanner");
		if (el) el.textContent += "Boot Error: " + e.message + "\n";
	}
});
else try { boot(); } catch(e) {
	var el = document.getElementById("__errBanner");
	if (el) el.textContent += "Boot Error: " + e.message + "\n";
}
})();
