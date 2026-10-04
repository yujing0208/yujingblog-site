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
		var k = "ts:" + schema.path;
		if (CACHE[k]) return Promise.resolve(CACHE[k]);
		return GIT.getFile(schema.owner, schema.repo, schema.path, schema.branch).then(function (f) {
			if (!f) throw new Error("文件不存在：" + schema.path);
			var v = TSIO.extract(f.content, schema.varName);
			if (v === null) throw new Error("无法解析 " + schema.path + " 的数据段（" + schema.varName + "）");
			CACHE[k] = { raw: f.content, sha: f.sha, value: v };
			return CACHE[k];
		});
	}
	function clearTs(schema) { delete CACHE["ts:" + schema.path]; }

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
		return collect("posts");
	}
	function loadPostsWithMeta() {
		if (CACHE.posts) return Promise.resolve(CACHE.posts);
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
					if (j && j.url) { input.value = j.url; toast("图床上传成功"); }
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
			row.innerHTML = '<span class="sp-tp">' + (it.del ? "删除" : "写入") + "</span>" +
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
	function pushAll() {
		var keys = Object.keys(STAGED);
		if (!keys.length) { openStage(false); return; }
		var changes = keys.map(function (k) {
			var it = STAGED[k];
			return it.del ? { path: k, delete: true } : { path: k, content: it.content };
		});
		var btn = $("#spPush");
		if (btn) { btn.disabled = true; btn.textContent = "推送中…"; }
		GIT.commitTree(OWNER, REPO, BRANCH, changes, "chore(editor): 批量更新 " + keys.length + " 项")
			.then(function () {
				STAGED = {}; syncStageUI(); renderStageList(); openStage(false);
				CACHE.posts = null;
				Object.keys(CACHE).forEach(function (k) { if (k.indexOf("ts:") === 0) delete CACHE[k]; });
				toast("推送成功，Vercel 构建已触发");
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
				'<button class="btn btn-sm btn-primary" type="button" data-imgup="' + fd.key + '">上传到图床</button></div>';
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
					box.insertBefore(t, inp); inp.value = ""; sync();
				}
			});
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
	var POSTS_STATE = { sel: null, filter: "all", sort: "date", q: "", draft: null };
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
	bindMdDrop($("#v-posts"));
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
			'<button class="cat-head" type="button" aria-expanded="true"><span class="cat-caret"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M9 6l6 6-6 6"/></svg></span><i class="cat-dot" style="background:' + color + '"></i><span class="cat-nm">' + esc(c) + '</span><span class="cat-n num">' + items.length + ' 篇</span></button>' +
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
	$$("#postsCatList .cat-head").forEach(function (b) {
		b.addEventListener("click", function () {
			var body = b.parentNode.querySelector(".cat-body");
			var open = b.getAttribute("aria-expanded") === "true";
			b.setAttribute("aria-expanded", open ? "false" : "true");
			if (body) body.style.display = open ? "none" : "";
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
	var path = "posts/" + today_ + "-" + slug + ".md";
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
function bindMdDrop(host) {
	if (!host || host.getAttribute("data-mdbound")) return;
	host.setAttribute("data-mdbound", "1");
	var on = function (e) {
		if (!e.dataTransfer) return;
		var fs = e.dataTransfer.files;
		var hasMd = fs && fs.length && Array.prototype.some.call(fs, function (f) { return /\.(md|markdown|mdx|txt)$/i.test(f.name) || f.type === "text/markdown"; });
		if (!hasMd) return;
		e.preventDefault(); e.stopPropagation();
		e.dataTransfer.dropEffect = "copy";
		host.classList.add("drop-hot");
	};
	["dragenter", "dragover"].forEach(function (ev) { host.addEventListener(ev, on); });
	["dragleave", "dragend"].forEach(function (ev) {
		host.addEventListener(ev, function (e) { if (!host.contains(e.relatedTarget)) host.classList.remove("drop-hot"); });
	});
	host.addEventListener("drop", function (e) {
		var fs = e.dataTransfer && e.dataTransfer.files;
		host.classList.remove("drop-hot");
		if (!fs || !fs.length) return;
		var md = Array.prototype.filter.call(fs, function (f) { return /\.(md|markdown|mdx|txt)$/i.test(f.name) || f.type === "text/markdown"; })[0];
		if (!md) return;
		e.preventDefault(); e.stopPropagation();
		var r = new FileReader();
		r.onload = function () { newPostFromText(String(r.result || ""), md.name, null); };
		r.readAsText(md, "utf-8");
	});
}

/* ================= 通用数据页（schema 驱动 · 预览稿皮肤） ================= */
var DATA_SEL = {};
function renderDataPage(id) {
	var schema = window.getSchema(id);
	if (!schema) return;
	schema.__id = id; /* schema 对象本身无 id 字段，供 id_new 使用 */
	var v = $("#v-" + id);
	v.innerHTML = pageHead(schema.icon || "db", schema.label,
		'<span class="mono">content/' + esc(schema.path) + '</span>' + (schema.varName ? ' · varName <span class="mono">' + esc(schema.varName) + '</span>' : ""),
		'<button class="btn btn-primary" type="button" id="dpAdd">+ 新增</button>') +
		'<div class="split"><div class="card split-list"><div id="dpList"><div class="empty-block">加载中…</div></div></div>' +
		'<div id="dpPanel"><div class="card"><div class="card-body"><div class="empty-block">从左侧选择一个条目，或点「+ 新增」</div></div></div></div></div>' +
		'<div id="dpHint"></div>';
	$("#dpAdd").addEventListener("click", function () {
		getTs(schema).then(function (ts) {
			var arr = ts.value;
			var item = { id: nextId(arr) };
			schema.fields.forEach(function (fd) { if (item[fd.key] === undefined && !fd.hidden) item[fd.key] = fd.type === "boolean" ? false : ""; });
			if (schema.id === "diary") item.date = nowISO();
			editDataItem(schema, ts, item, true);
		}).catch(function (e) { $("#dpList").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
	});
	getTs(schema).then(function (ts) {
		var arr = Array.isArray(ts.value) ? ts.value : [];
		renderDataList(schema, arr);
	}).catch(function (e) {
		$("#dpList").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>';
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
	var box = $("#dpList");
	box.innerHTML = "";
	arr.forEach(function (it, i) {
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
	DATA_SEL[schema.id] = idx;
	$$("#dpList .list-item").forEach(function (x) { x.classList.toggle("on", Number(x.getAttribute("data-i")) === idx); });
	var panel = $("#dpPanel");
	panel.innerHTML = '<div class="card"><div class="card-head"><h2 class="card-title">' + (isNew ? "新增" : esc(dataItemLabel(schema, item))) + '</h2><span class="pill">ts-array</span>' +
		(schema.id === "diary" ? '<span class="card-sub" style="margin-left:auto">隐藏 id 自动自增</span>' : (item.id != null ? '<span class="card-sub" style="margin-left:auto">id <span class="num">' + item.id + '</span>（隐藏）</span>' : '')) +
		'</div><div class="card-body" id="dpForm">' + renderFields(schema.fields, item) + '</div></div>' + saveBar(id_new(schema));
	var saveId = id_new(schema);
	bindFields($("#dpForm"), item);
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
				var content = TSIO.replace(ts2.raw, schema.varName, JSON.stringify(arr, null, 2).replace(/\n/g, "\n"));
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
				var content = TSIO.replace(ts2.raw, schema.varName, JSON.stringify(arr, null, 2));
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
	GIT.getFile(OWNER, REPO, "spec/about.md", BRANCH).then(function (f) {
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
			stagePut("spec/about.md", MDM.stringify(nfm, $("#abBody").value), "关于页面");
		});
		["abTitle", "abDesc", "abBody"].forEach(function (id) { $("#" + id).addEventListener("input", function () { DIRTY = true; }); });
	}).catch(function (e) { $("#abFm").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
}


/* ================= 相册管理 ================= */
function renderAlbums() {
	var v = $("#v-albums");
	v.innerHTML = pageHead("album", "相册管理", '<span class="mono">content/images/albums/</span>') +
		'<div class="split"><div class="card split-list"><div id="alList"><div class="empty-block">加载中…</div></div></div>' +
		'<div id="alPanel"><div class="card"><div class="card-body"><div class="empty-block">从左侧选择一个相册</div></div></div></div></div>';
	GIT.listDir(OWNER, REPO, "images/albums", BRANCH).then(function (dirs) {
		var box = $("#alList");
		box.innerHTML = "";
		var albumDirs = dirs.filter(function (d) { return d.type === "dir"; });
		if (!albumDirs.length) { box.innerHTML = '<div class="empty-block">暂无相册</div>'; return; }
		albumDirs.forEach(function (d, i) {
			GIT.listDir(OWNER, REPO, d.path, BRANCH).then(function (files) {
				var imgs = files.filter(function (x) { return x.type === "file"; });
				var row = el("div", "list-item" + (i === 0 ? " on" : ""));
				row.setAttribute("data-sel", "");
				row.innerHTML = '<div class="list-thumb">💌</div><div class="list-main"><div class="list-t">' + esc(d.name) + '</div><div class="list-s">' + imgs.length + ' 张</div></div>';
				row.addEventListener("click", function () { openAlbum(d, imgs); });
				box.appendChild(row);
				if (i === 0) openAlbum(d, imgs);
			});
		});
	}).catch(function (e) { $("#alList").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
}
function openAlbum(dir, imgs) {
	$("#alPanel").innerHTML = '<div class="card"><div class="card-head"><h2 class="card-title">' + esc(dir.name) + '</h2><span class="pill">images/</span></div>' +
		'<div class="card-body"><div class="grid-img" id="alGrid">' +
		imgs.map(function (f) {
			return '<div class="thumb" data-sel><div class="ph" style="background-image:url(/content-api/' + esc(dir.name) + '/' + esc(f.name) + ')"></div><div class="cap">' + esc(f.name) + '</div></div>';
		}).join("") + '</div>' +
		'<div class="f-hint" style="margin-top:14px">相册图片为内容仓二进制文件，编辑器仅预览；重命名/删除可走发布面板（暂存区）。</div></div></div>';
}

/* ================= 笔记本（书架） ================= */
var NB_BOOKS = [
	{ key: "campus", color: "#7aa585", lock: "🔒", ttl: "校园杂记", sub: "高中三年，值得留个档", tag1: "Markdown 日记", src: "内容仓", warn: "" },
	{ key: "run", color: "#e0996b", lock: "📖", ttl: "自律日记", sub: "跑过的路，一步都不白费", tag1: "跑步记录", src: "非内容仓", warn: "数据源不在内容仓，编辑器暂无法保存" },
	{ key: "daily", color: "#7d93c4", lock: "📖", ttl: "每日碎碎念", sub: "今天也在认真碎碎念", tag1: "短文本", src: "非内容仓", warn: "数据源不在内容仓，编辑器暂无法保存" },
];
function renderNotebooks() {
	var v = $("#v-notebooks");
	v.innerHTML = pageHead("note", "笔记本", '线上 <span class="mono">/notebooks/</span> 是一排书架 · <b>3 本</b> · 校园杂记取自 <span class="mono">content/data/notebooks.ts</span>',
		'<button class="btn btn-primary" type="button" id="nbAdd">+ 新增篇目</button>') +
		'<div class="nb-src"><span class="pill info">数据源</span><span><b>校园杂记</b> → <span class="mono">content/data/notebooks.ts</span> · <span class="mono">campusNotebook</span></span><span class="nb-src-sep"></span><span><b>自律日记 / 每日碎碎念</b> → 站点页内联（<b style="color:var(--bad)">不在内容仓</b>，编辑器无法保存）</span></div>' +
		'<div class="shelf" id="nbShelf"></div>' +
		'<div class="split"><div class="card split-list"><div class="card-head" style="padding:10px 12px"><span class="card-title" id="nbTocTitle">校园杂记 · 目录</span><span class="card-sub" style="margin-left:auto" id="nbTocSub"></span></div>' +
		'<div id="nbToc"><div class="empty-block">加载中…</div></div></div><div id="nbPane"><div class="card"><div class="card-body"><div class="empty-block">从左侧选择一篇</div></div></div></div></div>';
	getTs(window.getSchema("notebooks")).then(function (ts) {
		var arr = Array.isArray(ts.value) ? ts.value.slice().sort(function (a, b) { return String(b.h || "").localeCompare(String(a.h || "")); }) : [];
		$("#nbTocSub").textContent = arr.length + " 篇 · 倒序";
		var box = $("#nbToc");
		box.innerHTML = "";
		arr.forEach(function (it, i) {
			var row = el("div", "list-item" + (i === 0 ? " on" : ""));
			row.setAttribute("data-sel", "");
			row.innerHTML = '<div class="list-thumb" style="background:var(--bg-inset);font-size:11px">' + pad(arr.length - i) + '</div><div class="list-main"><div class="list-t">' + esc(it.h || "") + '</div><div class="list-s">' + esc(String(it.body || "").slice(0, 18)) + (String(it.body || "").length > 18 ? "…" : "") + '</div></div><div class="list-r num" style="font-size:11px">' + String(it.body || "").length + '</div>';
			row.addEventListener("click", function () { openNbItem(arr, it, i); });
			box.appendChild(row);
		});
		if (!arr.length) box.innerHTML = '<div class="empty-block">还没有篇目，点「+ 新增篇目」</div>';
		$("#nbAdd").addEventListener("click", function () {
			openNbItem(null, { h: today(), body: "" }, -1);
		});
	}).catch(function (e) { $("#nbToc").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
	var shelf = $("#nbShelf");
	NB_BOOKS.forEach(function (b, i) {
		var card = el("button", "book-card" + (i === 0 ? " on" : ""));
		card.type = "button";
		card.setAttribute("data-book", b.key);
		card.style.setProperty("--bk", b.color);
		card.innerHTML = '<span class="bk-band"></span><span class="bk-top"><span>YuJing Library</span><span>' + b.lock + '</span></span>' +
			'<span class="bk-main"><span class="bk-ttl">' + b.ttl + '</span><span class="bk-bandtx">' + b.sub + '</span></span>' +
			'<span class="bk-foot"><span class="bk-author">余京◎著</span></span>' +
			'<span class="bk-tags"><span class="pill" style="padding:0 6px">' + b.tag1 + '</span><span class="num">' + (b.key === "campus" ? "…" : "0 条") + '</span>' + (b.src === "非内容仓" ? '<span class="pill warn" style="padding:0 6px">非内容仓</span>' : "") + '</span>';
		card.addEventListener("click", function () {
			$$("#nbShelf .book-card").forEach(function (x) { x.classList.remove("on"); });
			card.classList.add("on");
			if (b.key !== "campus") {
				$("#nbToc").innerHTML = '<div class="nb-empty"><span class="nb-empty-ico">' + (b.key === "run" ? "🏃" : "📝") + '</span><b>数据不在内容仓</b><span>' + esc(b.warn) + '</span></div>';
				$("#nbPane").innerHTML = '<div class="card"><div class="card-body"><div class="nb-warn"><b>数据源不在内容仓。</b>编辑器只写内容仓 ⇒ 这本笔记本暂不可编辑。</div></div></div>';
			} else {
				loadView("notebooks", true);
			}
		});
		shelf.appendChild(card);
	});
}
function openNbItem(arr, it, idx) {
	var isNew = idx < 0;
	$$("#nbToc .list-item").forEach(function (x) { x.classList.toggle("on", false); });
	$("#nbPane").innerHTML = '<div class="card"><div class="card-head"><h2 class="card-title">校园杂记</h2><span class="pill">markdown</span></div>' +
		'<div class="card-body"><div class="form-grid">' +
		'<div class="f"><label class="f-label">日期<span class="req">*</span></label><input class="inp" type="date" id="nbH" value="' + esc(it.h || today()) + '"></div>' +
		'<div class="f wide"><label class="f-label">正文（Markdown）<span class="req">*</span></label><textarea class="inp mono ed-area" id="nbBody" style="min-height:260px;font-size:12.5px">' + esc(it.body || "") + '</textarea></div>' +
		'</div><div class="f-hint" style="margin-top:10px">写入 <span class="mono">content/data/notebooks.ts</span> 的 <span class="mono">campusNotebook</span> 数组，每条为 <span class="mono">{ h: "YYYY-MM-DD", body: "…" }</span></div></div></div>' +
		'<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" type="button" id="nbSave">💾 存入暂存区</button><div style="flex:1"></div>' + (isNew ? "" : '<button class="btn btn-danger" type="button" id="nbDel">🗑 删除本篇</button>') + '</div>';
	$("#nbSave").addEventListener("click", function () {
		var item = { h: $("#nbH").value, body: $("#nbBody").value };
		var list = arr.slice();
		if (isNew) list.push(item); else list[idx] = item;
		list.sort(function (a, b) { return String(a.h || "").localeCompare(String(b.h || "")); });
		getTs(window.getSchema("notebooks")).then(function (ts) {
			var content = TSIO.replace(ts.raw, "campusNotebook", JSON.stringify(list, null, 2));
			clearTs(window.getSchema("notebooks"));
			DIRTY = false;
			stagePut("data/notebooks.ts", content, "校园杂记");
			loadView("notebooks", true);
		});
	});
	var del = $("#nbDel");
	if (del) del.addEventListener("click", function () {
		if (!confirm("删除本篇？（先入暂存区）")) return;
		var list = arr.filter(function (x) { return x !== it; });
		getTs(window.getSchema("notebooks")).then(function (ts) {
			var content = TSIO.replace(ts.raw, "campusNotebook", JSON.stringify(list, null, 2));
			clearTs(window.getSchema("notebooks"));
			stagePut("data/notebooks.ts", content, "校园杂记（删除一篇）");
			loadView("notebooks", true);
		});
	});
}

/* ================= 站点与外观（settings · tabs + 递归折叠表单） ================= */
var SETTINGS_FILES = ["site", "hero", "navbar", "footer", "profile", "comment", "music", "wallpaper", "license"];
var SETTINGS_LOADED = {};
function settingsVarName(file) { return file.charAt(0).toUpperCase() + file.slice(1) + "Config"; }
function renderSettings() {
	var v = $("#v-settings");
	v.innerHTML = pageHead("sys", "站点与外观", '<span class="mono">content/settings/</span> · 9 个文件 · 最深 4 层 → 递归折叠表单') +
		'<div class="card"><div class="tabs" style="padding:0 8px">' +
		SETTINGS_FILES.map(function (f, i) { return '<button class="tab' + (i === 0 ? " on" : "") + '" data-tab="s-' + f + '">' + f + '</button>'; }).join("") +
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
	var varName = settingsVarName(file);
	GIT.getFile(OWNER, REPO, "settings/" + file + ".ts", BRANCH).then(function (f) {
		if (!f) { body.innerHTML = '<div class="error-block">settings/' + file + '.ts 不存在</div>'; return; }
		var val = TSIO.extract(f.content, varName);
		var mode = "var";
		if (val === null) {
			var m = f.content.match(/export\s+default\s+\{([\s\S]*)\};?\s*$/);
			if (m) { try { val = eval("({" + m[1] + "})"); mode = "default"; } catch (e) { val = null; } }
		}
		if (val === null || typeof val !== "object") { body.innerHTML = '<div class="error-block">无法解析 ' + varName + '</div>'; return; }
		SETTINGS_LOADED[file] = { raw: f.content, sha: f.sha, val: val, mode: mode };
		renderSettingsBody(file);
	}).catch(function (e) { body.innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
}
function renderSettingsBody(file) {
	var ctx = SETTINGS_LOADED[file];
	var body = $("#setBody");
	if (!ctx || !body) return;
	var html = '<div id="setForm">' + settingsFormHtml(file, ctx.val, "") + '</div>';
	if (ctx.mode === "var") {
		html += '<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" type="button" id="setSave">💾 存入暂存区（' + esc(file) + '.ts）</button></div>';
	} else {
		html += '<div class="f-hint" style="margin-top:10px">该文件是 export default 写法，无法精确回写，暂不支持保存。</div>';
	}
	body.innerHTML = html;
	bindSettingsFields(file);
	var sb = $("#setSave");
	if (sb) sb.addEventListener("click", function () {
		var content = TSIO.replace(ctx.raw, settingsVarName(file), JSON.stringify(ctx.val, null, 2));
		DIRTY = false;
		stagePut("settings/" + file + ".ts", content, "站点与外观 · " + file);
		toast("已暂存：" + file + ".ts");
	});
}
function settingsFormHtml(file, obj, prefix) {
	var h = '<div class="form-grid">';
	Object.keys(obj).forEach(function (k) {
		var val = obj[k];
		var fk = prefix + k;
		if (val && typeof val === "object" && !Array.isArray(val)) return; /* 折叠区单独渲染 */
		if (Array.isArray(val) && val.length && typeof val[0] === "object") return;
		h += settingsFieldHtml(k, fk, val);
	});
	h += '</div>';
	Object.keys(obj).forEach(function (k) {
		var val = obj[k];
		var fk = prefix + k;
		if (val && typeof val === "object" && !Array.isArray(val)) {
			h += '<details class="fold" style="margin-top:14px"><summary><svg class="arw" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>' + esc(k) + ' <span class="f-key">' + fk + '</span></summary><div class="fold-body">' + settingsFormHtml(file, val, fk + ".") + '</div></details>';
		} else if (Array.isArray(val) && val.length && typeof val[0] === "object") {
			h += '<details class="fold" style="margin-top:14px"><summary><svg class="arw" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>' + esc(k) + ' <span class="f-key">' + fk + '</span><span class="fold-meta">数组 · ' + val.length + ' 项</span></summary><div class="fold-body">';
			val.forEach(function (item, i) {
				h += '<div class="block"><div class="block-head" style="display:flex;gap:10px;align-items:center"><span>⠿</span>' + esc(k) + '[' + i + ']<div style="flex:1"></div></div><div class="card-body">' + settingsFormHtml(file, item, fk + "." + i + ".") + '</div></div>';
			});
			h += '</div></details>';
		}
	});
	return h;
}
function settingsFieldHtml(label, fk, val) {
	var type = typeof val;
	if (type === "boolean") {
		return '<div class="f"><label class="f-label">' + esc(label) + ' <span class="f-key">' + esc(fk) + '</span></label><label class="sw"><input type="checkbox" data-sk="' + esc(fk) + '"' + (val ? " checked" : "") + '><i></i></label></div>';
	}
	if (type === "number") {
		return '<div class="f"><label class="f-label">' + esc(label) + ' <span class="f-key">' + esc(fk) + '</span></label><input class="inp num" type="number" data-sk="' + esc(fk) + '" value="' + esc(val) + '"></div>';
	}
	if (type === "string" && /\/|https?:/.test(val) && String(val).length > 3) {
		return '<div class="f wide"><label class="f-label">' + esc(label) + ' <span class="f-key">' + esc(fk) + '</span></label><input class="inp mono" data-sk="' + esc(fk) + '" value="' + esc(val) + '"></div>';
	}
	if (type === "string" && String(val).length > 40) {
		return '<div class="f wide"><label class="f-label">' + esc(label) + ' <span class="f-key">' + esc(fk) + '</span></label><textarea class="inp" rows="2" data-sk="' + esc(fk) + '">' + esc(val) + '</textarea></div>';
	}
	return '<div class="f"><label class="f-label">' + esc(label) + ' <span class="f-key">' + esc(fk) + '</span></label><input class="inp" data-sk="' + esc(fk) + '" value="' + esc(val == null ? "" : val) + '"></div>';
}
function bindSettingsFields(file) {
	var ctx = SETTINGS_LOADED[file];
	if (!ctx) return;
	$$('#setBody [data-sk]').forEach(function (inp) {
		if (inp.dataset.sbound) return;
		inp.dataset.sbound = "1";
		var path = inp.getAttribute("data-sk").split(".");
		var ev = inp.type === "checkbox" ? "change" : "input";
		inp.addEventListener(ev, function () {
			var obj = ctx.val;
			for (var i = 0; i < path.length - 1; i++) obj = obj[path[i]];
			var k = path[path.length - 1];
			obj[k] = inp.type === "checkbox" ? inp.checked : (inp.classList.contains("num") ? Number(inp.value) : inp.value);
			DIRTY = true;
		});
	});
}


/* ================= 仪表盘 ================= */
function loading(text) { return '<div class="loading-block"><span class="spin"></span>' + (text || "加载中…") + "</div>"; }
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
	return '<div class="card don-card" id="' + id + '"><div class="card-head"><h2 class="card-title">站点储存分布</h2><span class="card-sub" style="margin-left:auto">点分类可下钻</span></div>' +
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
	var tot = node.bytes || kids.reduce(function (a, c) { return a + c.bytes; }, 0) || 1;
	root.__tree = node;
	/* __tree 同时挂在 data-donut 容器与卡片上（下钻处理器从 [data-donut] 起查） */
	var anchor = (root.matches && root.matches("[data-donut]")) ? root : (root.querySelector ? root.querySelector("[data-donut]") : null);
	if (anchor) anchor.__tree = node;
	var card = root.closest ? root.closest(".don-card") : null;
	if (card) card.__tree = node;
	var svg = root.querySelector(".donut svg g");
	var center = root.querySelector(".don-center");
	var legend = root.querySelector(".don-legend");
	var bar = root.querySelector(".don-crumb");
	if (!svg || !center || !legend) return;
	var off = 0, arcs = "";
	kids.forEach(function (c, i) {
		var ratio = c.bytes / tot;
		var len = ratio * C;
		arcs += '<circle cx="75" cy="75" r="54" fill="none" stroke="' + DON_PAL[i % DON_PAL.length] + '" stroke-width="15"'
			+ ' stroke-dasharray="' + len.toFixed(2) + " " + (C - len).toFixed(2) + '"'
			+ ' stroke-dashoffset="' + (-off).toFixed(2) + '"'
			+ (c.id ? ' data-drill="' + esc(c.id) + '" style="cursor:pointer"' : "")
			+ '><title>' + esc(c.nm) + " " + fmtBytes(c.bytes) + " / " + (ratio * 100).toFixed(1) + '%</title></circle>';
		off += ratio * C;
	});
	svg.innerHTML = arcs;
	center.innerHTML = '<b class="num">' + (tot / 1048576).toFixed(1) + '</b><span>' + (node.bytes ? "MB · 该分类" : "MB 合计") + '</span>';
	var lg = "";
	kids.forEach(function (c, i) {
		var ratio = c.bytes / tot;
		lg += '<li class="don-item"' + (c.id ? ' data-drill="' + esc(c.id) + '" title="点击下钻"' : "") + '>'
			+ '<i class="don-dot" style="background:' + DON_PAL[i % DON_PAL.length] + '"></i>'
			+ '<span class="don-nm">' + esc(c.nm) + '</span>'
			+ '<span class="don-sz num">' + (c.bytes / 1048576).toFixed(1) + ' MB</span>'
			+ '<span class="don-pc num">' + (ratio * 100).toFixed(1) + '%</span></li>';
	});
	legend.innerHTML = lg;
	if (bar) {
		bar.hidden = false;
		bar.style.visibility = crumb ? "visible" : "hidden";
		if (crumb) bar.querySelector(".don-crumb-tx").textContent = "当前：" + node.nm;
	}
}
function treeToDonut(tree) {
	/* 两级树：一级 = 顶层目录（可下钻），二级 = 顶层目录下的一级子目录 */
	var top = {};
	(tree.tree || []).forEach(function (t) {
		if (t.type !== "blob") return;
		var parts = t.path.split("/");
		var seg = parts[0];
		var sub = parts.length > 1 ? parts[1] : "（根文件）";
		if (!top[seg]) top[seg] = { nm: seg + "/", id: "seg:" + seg, bytes: 0, files: 0, kids: {} };
		top[seg].bytes += t.size || 0;
		top[seg].files += 1;
		if (!top[seg].kids[sub]) top[seg].kids[sub] = { nm: sub + "/", id: "seg:" + seg + "/" + sub, bytes: 0, files: 0 };
		top[seg].kids[sub].bytes += t.size || 0;
		top[seg].kids[sub].files += 1;
	});
	var kids = Object.keys(top).map(function (k) {
		var s = top[k];
		s.children = Object.keys(s.kids).map(function (sk) { return s.kids[sk]; })
			.sort(function (a, b) { return b.bytes - a.bytes; }).slice(0, 8);
		delete s.kids;
		return s;
	}).sort(function (a, b) { return b.bytes - a.bytes; }).slice(0, 6);
	return { nm: "全部储存", children: kids.length ? kids : [{ nm: "（空）", bytes: 1, files: 0, id: null }] };
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
		'<div class="card"><div class="card-head"><h2 class="card-title">站点流量统计</h2><span class="card-sub" style="margin-left:auto">近 31 天 · Umami 分享 API</span></div><div class="card-body trend-body" id="dashTrend">' + loading() + '</div></div>' +
		'<div id="dashDonut">' + loading("正在统计内容仓体积…") + "</div></div>" +
		'<div class="dash-2col" style="margin-top:14px"><div><div class="card"><div class="card-head"><h2 class="card-title">最新评论</h2><button class="cmt-all" type="button" id="cmtAllBtn">查看全部</button></div><div class="cmt-list" id="dashCmts">' + loading() + '</div></div></div>' +
		'<div><div class="card"><div class="card-head"><h2 class="card-title">最近提交</h2><button class="cmt-all" type="button" id="depAllBtn" title="打开 Vercel 构建历史">查看全部</button></div><div id="dashCommits">' + loading() + '</div></div></div></div>');
	$("#dashRefresh").addEventListener("click", function () { CACHE.posts = null; CACHE.comments = null; Object.keys(CACHE).forEach(function (k) { if (k.indexOf("ts:") === 0) delete CACHE[k]; }); renderDash(); });
	$("#cmtAllBtn").addEventListener("click", function () { go("comments"); });
	$("#depAllBtn").addEventListener("click", function () { window.open("https://vercel.com/yujing/~/deployments", "_blank", "noopener"); });
	bindMdDrop($("#v-dash"));
	var jobs = [
		withTimeout(loadPostsWithMeta(), 20000),
		withTimeout(getTs(window.getSchema("diary")), 10000),
		withTimeout(getTs(window.getSchema("friends")), 10000),
		withTimeout(twikooRecent(), 8000),
		withTimeout(umami("/pageviews", "startAt=" + (Date.now() - 31 * 86400000) + "&endAt=" + Date.now() + "&unit=day&timezone=Asia%2FShanghai"), 8000),
		withTimeout(ghTree(REPO), 12000),
		withTimeout(ghCommits(REPO, 3), 8000),
	];
	Promise.all(jobs).then(function (rs) {
		var posts = rs[0], diary = rs[1], friends = rs[2], comments = rs[3], pv = rs[4], tree = rs[5], commits = rs[6];
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
		if (tree) {
			var node = treeToDonut(tree);
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
	if (back) { go(current, true); return; }
	var d = e.target.closest("[data-drill]");
	if (d) {
		var root = d.closest("[data-donut]");
		if (root && root.__tree) {
			var id = d.getAttribute("data-drill");
			var hit = null;
			(root.__tree.children || []).forEach(function (c) { if (c.id === id || c.nm === id) hit = c; });
			if (hit) donutDraw(root, hit, id); else donutDraw(root, root.__tree, null);
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
		pageHead("up", "发布状态", 'GitHub commit status + Vercel · 只读',
			'<button class="btn" type="button" id="relRefresh">↻ 刷新</button><button class="btn btn-primary" type="button" id="relVercel">打开 Vercel 构建历史</button>') +
		'<div class="stat-row">' +
		'<div class="card stat"><div class="stat-k">当前状态</div><div class="stat-v" style="font-size:20px;color:var(--ok)" id="relState">检测中…</div><div class="stat-f">Vercel · Production</div></div>' +
		'<div class="card stat"><div class="stat-k">站点仓最新提交</div><div class="stat-v mono" style="font-size:17px" id="relSiteSha">…</div><div class="stat-f">yujingblog-site · main</div></div>' +
		'<div class="card stat"><div class="stat-k">内容仓最新提交</div><div class="stat-v mono" style="font-size:17px" id="relSha">…</div><div class="stat-f">yujingblog-content · master</div></div>' +
		'<div class="card stat"><div class="stat-k">暂存区</div><div class="stat-v" style="font-size:20px" id="relStage">0 项</div><div class="stat-f">待统一推送</div></div></div>' +
		'<div class="card"><div class="card-head"><h2 class="card-title">内容仓最近提交</h2></div><div id="relList">' + loading() + '</div></div>' +
		'<div class="card"><div class="card-head"><h2 class="card-title">站点仓最近提交</h2></div><div id="relSiteList">' + loading() + "</div></div>");
	$("#relVercel").addEventListener("click", function () { window.open("https://vercel.com/yujing/~/deployments", "_blank", "noopener"); });
	$("#relRefresh").addEventListener("click", function () { renderRelease(); });
	ghCommits(REPO, 8).then(function (cs) {
		$("#relSha").textContent = cs.length ? String(cs[0].sha).slice(0, 7) : "—";
		$("#relList").innerHTML = cs.map(commitRowHtml).join("") || '<div class="empty-block">暂无提交</div>';
	}).catch(function (e) { $("#relList").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
	ghCommits(SITE_REPO, 8, SITE_BRANCH).then(function (cs) {
		$("#relSiteSha").textContent = cs.length ? String(cs[0].sha).slice(0, 7) : "—";
		$("#relState").textContent = "已上线";
		$("#relSiteList").innerHTML = cs.map(commitRowHtml).join("") || '<div class="empty-block">暂无提交</div>';
	}).catch(function (e) { $("#relSiteList").innerHTML = '<div class="error-block">' + esc(e.message) + '</div>'; });
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
				$("#cfSub").textContent = j.total != null ? "共 " + j.total + " 个" : "";
				$("#cfPageInfo").textContent = "第 " + CF.page + " 页";
				$("#cfGrid").innerHTML = files.length ? files.map(function (f) {
					return '<div class="thumb" data-sel data-url="' + esc(f.url || "") + '"><div class="ph" style="background-image:url(\'' + esc(f.url || "") + '\')"></div><div class="cap">' + esc(String(f.name || "").slice(0, 26)) + '</div><div class="thumb-meta"><span class="num">' + fmtBytes(f.size) + '</span></div></div>';
				}).join("") : '<div class="empty-block">没有文件</div>';
				$$("#cfGrid .thumb").forEach(function (t) {
					t.addEventListener("click", function () {
						promptImgUse(t.getAttribute("data-url"));
					});
				});
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
function renderStats() {
	setView("stats",
		pageHead("chart", "网站统计", 'Umami（浏览量 / 访问 / 游客 + 文章排行）· Twikoo（评论）· 实时拉取',
			'<button class="btn" type="button" id="stRefresh">↻ 刷新</button>') +
		'<div class="stat-row" id="stRow">' + loading() + "</div>" +
		'<div class="card" style="margin-top:14px"><div class="card-head"><h2 class="card-title">文章阅读量排行</h2><span class="pill info">GET /metrics?type=title</span></div>' +
		'<div data-ranklist id="stRank">' + loading() + "</div></div>");
	$("#stRefresh").addEventListener("click", function () { renderStats(); });
	Promise.all([
		withTimeout(umami("/stats", "startAt=" + (Date.now() - 30 * 86400000) + "&endAt=" + Date.now()), 8000),
		withTimeout(umami("/metrics", "startAt=" + (Date.now() - 30 * 86400000) + "&endAt=" + Date.now() + "&type=title"), 8000),
		withTimeout(twikooRecent(), 8000),
	]).then(function (rs) {
		var s = rs[0] || {}, m = rs[1] || {}, cmts = rs[2] || [];
		var rows = m.metrics || m.rows || [];
		$("#stRow").innerHTML =
			'<div class="card stat"><div class="stat-k">浏览量 · 近 30 天</div><div class="stat-v num">' + ((s.pageviews || {}).value != null ? s.pageviews.value.toLocaleString() : "—") + '</div><div class="stat-f">Umami pageviews</div></div>' +
			'<div class="card stat"><div class="stat-k">访问数 · 近 30 天</div><div class="stat-v num">' + ((s.visits || {}).value != null ? s.visits.value.toLocaleString() : "—") + '</div><div class="stat-f">visits</div></div>' +
			'<div class="card stat"><div class="stat-k">游客数 · 近 30 天</div><div class="stat-v num">' + ((s.visitors || {}).value != null ? s.visitors.value.toLocaleString() : "—") + '</div><div class="stat-f">visitors</div></div>' +
			'<div class="card stat"><div class="stat-k">评论总数</div><div class="stat-v num">' + cmts.length + '</div><div class="stat-f">Twikoo · 本月 +' + cmts.filter(function (c) { return c.created >= MONTH_START; }).length + "</div></div>";
		var total = rows.reduce(function (a, r) { return a + (r.y || 0); }, 0) || 1;
		var max = Math.max.apply(null, rows.map(function (r) { return r.y || 0; }).concat([1]));
		$("#stRank").innerHTML = rows.length ? rows.slice(0, 12).map(function (r, i) {
			return '<div class="rank-row"><span class="rank-i num">' + (i + 1) + '</span><div class="rank-k"><div class="rank-t">' + esc(r.x || r.path || r.url || "?") + '</div><div class="rank-bar"><i style="width:' + ((r.y || 0) / max * 100).toFixed(1) + '%"></i></div></div><span class="rank-v num">' + (r.y || 0) + '</span><span class="rank-p num">' + ((r.y || 0) / total * 100).toFixed(1) + '%</span></div>';
		}).join("") : '<div class="empty-block">暂无排行数据</div>';
	}).catch(function (e) {
		$("#stRow").innerHTML = '<div class="error-block">' + esc(e.message) + "</div>";
		$("#stRank").innerHTML = "";
	});
}

/* ================= 数据备份 ================= */
function renderBackup() {
	setView("backup",
		pageHead("db", "数据备份", "内容仓 git 历史即备份 · 自动打 tag 记录发布点") +
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
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
})();
