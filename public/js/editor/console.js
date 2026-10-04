/**
 * /admin 单页管理台 · 控制台版 v1
 * 设计：preview/editor-preview.html 签收版；引擎：EditorGit/EditorTsIO/EditorMd/EditorForm
 *
 * v1 范围：
 *   - 仪表盘（真数据：文章/动态/友链/评论 KPI、Umami 趋势、Git 储存分布、最新评论、最近提交）
 *   - 文章管理（列表/新建/上传 md/编辑 frontmatter+正文/实时预览/暂存→统一推送）
 *   - 数据页（diary/friends/projects/website/timeline/anime/devices/footprints/notebooks/about，
 *     schema 驱动 + 暂存/推送，逻辑与旧编辑器 app.v2.js 对齐）
 *   - 站点与外观（9 个 settings，通用递归表单）
 *   - 全部评论 / 网站统计（Twikoo + Umami）/ 发布状态 / CF 图床 / 数据备份
 *   - 相册、公告：跳转旧版编辑器（后续迭代迁入）
 */
(function () {
	"use strict";

	/* ================= 基础 ================= */
	var GIT = window.EditorGit, TSIO = window.EditorTsIO, MDM = window.EditorMd, FORM = window.EditorForm;
	var OWNER = "yujing0208", REPO = "yujingblog-content", BRANCH = "master";
	var TWIKOO_URL = "https://twikoo.yujingblog.top/api/comment";
	var SITE_URL = "https://yujingblog.top";
	var VERCEL_DEPLOY = "https://vercel.com/yujing/~/deployments";
	var MONTH_START = (function () { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); })();

	function $(s, r) { return (r || document).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
	function el(tag, cls, html) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (html !== undefined) e.innerHTML = html;
		return e;
	}
	function esc(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}
	function toast(msg, ms) {
		var t = el("div", null, esc(msg));
		t.style.cssText = "position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:rgba(20,20,30,.92);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,.3)";
		document.body.appendChild(t);
		setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ms || 2200);
	}
	function fmtMB(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : (b / 1024).toFixed(0) + " KB"; }
	function pad(n) { return (n < 10 ? "0" : "") + n; }
	function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
	function nowISO() { return today() + "T" + pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()) + ":00+08:00"; }
	function fmtDate(ts) { var d = new Date(ts); return pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
	function relTime(ts) {
		var s = (Date.now() - ts) / 1000;
		if (s < 60) return "刚刚";
		if (s < 3600) return Math.floor(s / 60) + " 分钟前";
		if (s < 86400) return Math.floor(s / 3600) + " 小时前";
		if (s < 86400 * 30) return Math.floor(s / 86400) + " 天前";
		if (s < 86400 * 365) return Math.floor(s / 86400 / 30) + " 个月前";
		return Math.floor(s / 86400 / 365) + " 年前";
	}
	function loading(msg) { return '<div class="loading-block"><span class="spin"></span>' + esc(msg || "加载中…") + "</div>"; }
	function errBox(msg) { return '<div class="error-block">' + esc(msg) + "</div>"; }
	function insertAtCursor(ta, text) {
		if (!ta) return;
		var start = ta.selectionStart || 0, end = ta.selectionEnd || 0, v = ta.value;
		ta.value = v.slice(0, start) + text + v.slice(end);
		var pos = start + text.length;
		ta.selectionStart = ta.selectionEnd = pos;
		ta.focus();
	}

	/* ================= 主题跟随（读博客 localStorage） ================= */
	var BLOG_ACCENTS = { orange: 60, purple: 290, sakura: 345, blue: 230, pink: 320, green: 140, black: 30 };
	function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
	function applyBlogLook() {
		var accent = lsGet("paper-accent"); if (!BLOG_ACCENTS[accent]) accent = "green";
		var theme = lsGet("theme") === "dark" ? "dark" : "light";
		document.documentElement.setAttribute("data-accent", accent);
		document.documentElement.classList.toggle("dark", theme === "dark");
	}
	window.addEventListener("storage", function (e) {
		if (e.key === "paper-accent" || e.key === "theme") applyBlogLook();
	});

	/* ================= 数据层 ================= */
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
	function ghCommits(repo, n) {
		return gh("/repos/" + OWNER + "/" + repo + "/commits?per_page=" + (n || 5));
	}
	function ghTree(repo) {
		return gh("/repos/" + OWNER + "/" + repo + "/git/trees/" + (repo === REPO ? BRANCH : "main") + "?recursive=1");
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

	/* ================= 暂存 / 推送 ================= */
	var STAGED = {};
	function stagePut(path, content, label) {
		STAGED[path] = { path: path, content: content, label: label || path, del: false, tm: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) };
		syncStageUI(); renderStageList();
		toast("已暂存：" + path.split("/").pop() + "（待推送）");
	}
	function stageDelete(path, label) {
		STAGED[path] = { path: path, content: null, label: label || path, del: true, tm: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) };
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
		if (!keys.length) { box.innerHTML = '<div class="empty-block">暂存区是空的。编辑内容后点「存入暂存区」，可跨页面攒多次改动，一次推送。</div>'; return; }
		keys.forEach(function (k) {
			var it = STAGED[k];
			var row = el("div", "sp-item");
			row.innerHTML = '<span class="sp-tp">' + (it.del ? "删除" : "写入") + "</span>" +
				'<span class="sp-nm" title="' + esc(k).replace(/"/g, "&quot;") + '">' + esc(k) + "</span>" +
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
		if (on) renderStageList();
	}
	function showDiff(oldSrc, newSrc, onConfirm) {
		var ov = el("div", "diff-overlay");
		var box = el("div", "diff-box");
		box.innerHTML = "<h3>推送前确认（左：当前远端 · 右：将写入）</h3>" +
			'<div class="diff-cols"><pre class="diff-pre">' + esc(oldSrc) + "</pre><pre>" + esc(newSrc) + "</pre></div>";
		var acts = el("div", null);
		acts.style.cssText = "display:flex;gap:10px;margin-top:12px;justify-content:flex-end";
		var cancel = el("button", "btn", "取消");
		var ok = el("button", "btn btn-primary", "确认存入暂存区");
		cancel.addEventListener("click", function () { document.body.removeChild(ov); });
		ok.addEventListener("click", function () { document.body.removeChild(ov); onConfirm(); });
		acts.appendChild(cancel); acts.appendChild(ok);
		box.appendChild(acts);
		ov.appendChild(box);
		document.body.appendChild(ov);
	}
	function pushAll() {
		var paths = Object.keys(STAGED);
		if (!paths.length) return;
		if (!confirm("确认统一推送 " + paths.length + " 项变更？（合并为 1 次提交并触发部署）")) return;
		var changes = paths.map(function (p) {
			var e = STAGED[p];
			return e.del ? { path: p, delete: true } : { path: p, content: e.content };
		});
		var btn = $("#pushBtn"); if (btn) btn.disabled = true;
		var st = $("#status"); st.style.display = ""; st.className = "status s-build"; $("#statusText").textContent = "推送中…";
		GIT.commitTree(OWNER, REPO, BRANCH, changes, "chore(editor): 批量更新 " + paths.length + " 项")
			.then(function (r) {
				if (!r || !r.commitSha) throw new Error("提交返回为空，可能未生效");
				paths.forEach(function (p) { delete STAGED[p]; });
				syncStageUI(); renderStageList(); openStage(false);
				toast("✅ 推送成功（" + paths.length + " 项，1 次提交）· 构建部署中", 2800);
				st.className = "status s-live"; $("#statusText").textContent = "已推送，构建中";
				setTimeout(function () { syncStageUI(); }, 4000);
				CACHE.posts = null; CACHE.comments = null;
				Object.keys(CACHE).forEach(function (k) { if (k.indexOf("ts:") === 0) delete CACHE[k]; });
				loadView(current, true);
			})
			.catch(function (e) {
				alert("推送失败：" + e.message);
				syncStageUI();
			})
			.then(function () { if (btn) btn.disabled = false; });
	}

	/* ================= 视图骨架 ================= */
	function pageHead(icon, title, desc, actions) {
		return '<div class="page-head"><div class="page-chip">' + icon + "</div>" +
			"<div><h1 class=\"page-title\">" + esc(title) + "</h1>" + (desc ? '<p class="page-desc">' + desc + "</p>" : "") + "</div>" +
			'<div class="page-actions">' + (actions || "") + "</div></div>";
	}
	function setView(id, html) {
		var v = $("#v-" + id);
		if (v) v.innerHTML = html;
	}

	/* ================= 仪表盘 ================= */
	function kpiFrame(id, icon, tint, k, act, key) {
		return '<div class="card kpi' + (act ? " kpi-act" : "") + '"' + (act ? ' data-kpi="' + key + '" role="button" tabindex="0"' : "") + ">" +
			'<div class="kpi-ic ' + tint + '">' + icon + "</div>" +
			'<div class="kpi-bd"><div class="kpi-k">' + k + '</div><div class="kpi-v num" id="' + id + 'V">—</div>' +
			'<div class="kpi-d" id="' + id + 'D">加载中…</div>' +
			(act ? '<div class="kpi-go">' + (key === "post" ? "点击新建 / 拖入 .md" : "点击新建动态") + "</div>" : "") +
			"</div></div>";
	}
	function dashFrame() {
		var html = "";
		html += '<div class="page-head greet"><div><h1 class="page-title greet-title">欢迎回来，YuJing <span class="greet-emoji">👋</span></h1>' +
			'<p class="page-desc">今天是分享知识的好时光。</p></div>' +
			'<div class="page-actions"><span class="muted2" style="font-size:12px">数据实时拉取 · ' + today() + "</span>" +
			'<button class="btn btn-icon" type="button" id="dashRefresh" title="刷新数据"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></button></div></div>';
		html += '<div class="stat-row">' +
			kpiFrame("kPost", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h11l5 5v11H4z"/><path d="M15 4v5h5"/><path d="M8.5 13h7M8.5 16.5h4.5"/></svg>', "kpi-purple", "文章总数", true, "post") +
			kpiFrame("kDiary", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/></svg>', "kpi-green", "动态条数", true, "diary") +
			kpiFrame("kFriend", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.1 2.1a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>', "kpi-blue", "友链总数") +
			kpiFrame("kCmt", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.8-.4L3 21l1.5-4.4A8.4 8.4 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4h.6a8.4 8.4 0 0 1 8.4 8.4z"/></svg>', "kpi-orange", "评论总数") +
			"</div>";
		html += '<div class="dash-top">';
		html += '<div class="card"><div class="card-head"><h2 class="card-title">站点流量统计</h2><span class="card-sub" style="margin-left:auto">近 31 天 · Umami 分享 API</span></div><div class="card-body trend-body" id="dashTrend">' + loading() + "</div></div>";
		html += '<div id="dashDonut">' + loading("正在统计内容仓体积…") + "</div>";
		html += "</div>";
		html += '<div class="dash-2col" style="margin-top:14px"><div><div class="card"><div class="card-head"><h2 class="card-title">最新评论</h2><button class="cmt-all" type="button" id="cmtAllBtn">查看全部</button></div><div class="cmt-list" id="dashCmts">' + loading() + '</div></div></div><div><div class="card"><div class="card-head"><h2 class="card-title">最近提交</h2><button class="cmt-all" type="button" id="depAllBtn" title="打开 Vercel 构建历史">查看全部</button></div><div id="dashCommits">' + loading() + "</div>";
		html += '<div class="card-body" id="dashStagedLine" style="border-top:1px solid var(--line-soft);font-size:12px;color:var(--ink-3);line-height:1.7">当前暂存区 <b class="num">0</b> 项待推送。推送后自动触发 Vercel 构建。</div>';
		html += "</div></div></div>";
		setView("dash", html);
		bindDash();
	}
	function renderDash() {
		dashFrame();
		var jobs = [
			withTimeout(loadPostsWithMeta(), 20000),
			withTimeout(getTs(window.getSchema("diary")), 10000),
			withTimeout(getTs(window.getSchema("friends")), 10000),
			withTimeout(twikooRecent(), 8000),
			withTimeout(umami("/pageviews", "startAt=" + (Date.now() - 31 * 86400000) + "&endAt=" + Date.now() + "&unit=day&timezone=Asia%2FShanghai"), 8000),
			withTimeout(ghTree(REPO), 12000),
			withTimeout(ghCommits(REPO, 3), 8000),
		];
		return Promise.all(jobs).then(function (rs) {
			var posts = rs[0], diary = rs[1], friends = rs[2], comments = rs[3], pv = rs[4], tree = rs[5], commits = rs[6];
			var html = "";

			html += '<div class="page-head greet"><div><h1 class="page-title greet-title">欢迎回来，YuJing <span class="greet-emoji">👋</span></h1>' +
				'<p class="page-desc">今天是分享知识的好时光。</p></div>' +
				'<div class="page-actions"><span class="muted2" style="font-size:12px">数据实时拉取 · ' + today() + "</span>" +
				'<button class="btn btn-icon" type="button" id="dashRefresh" title="刷新数据"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></button></div></div>';

			/* KPI */
			var postN = posts ? posts.length : "—";
			var postNew = posts ? posts.filter(function (p) { var t = Date.parse(p.fm.published || "") || 0; return t >= MONTH_START; }).length : 0;
			var diaryN = diary && Array.isArray(diary.value) ? diary.value.length : "—";
			var diaryNew = diary && Array.isArray(diary.value) ? diary.value.filter(function (d) { var t = Date.parse(d.date || "") || 0; return t >= MONTH_START; }).length : 0;
			var friendN = friends && Array.isArray(friends.value) ? friends.value.length : "—";
			var cmtN = comments ? comments.length : "—";
			var cmtNew = comments ? comments.filter(function (c) { return c.created >= MONTH_START; }).length : 0;
			function kpi(icon, tint, k, v, d, act, key) {
				return '<div class="card kpi' + (act ? " kpi-act" : "") + '"' + (act ? ' data-kpi="' + key + '" role="button" tabindex="0"' : "") + ">" +
					'<div class="kpi-ic ' + tint + '">' + icon + "</div>" +
					'<div class="kpi-bd"><div class="kpi-k">' + k + '</div><div class="kpi-v num">' + v + "</div>" +
					'<div class="kpi-d ' + (d ? "up" : "zero") + '">' + d + "</div>" +
					(act ? '<div class="kpi-go">' + (key === "post" ? "点击新建 / 拖入 .md" : "点击新建动态") + "</div>" : "") +
					"</div></div>";
			}
			html += '<div class="stat-row">' +
				kpi('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h11l5 5v11H4z"/><path d="M15 4v5h5"/><path d="M8.5 13h7M8.5 16.5h4.5"/></svg>', "kpi-purple", "文章总数", postN,
					postNew > 0 ? '<b class="kpi-num">+' + postNew + "</b> 本月新增" : "本月无新增", true, "post") +
				kpi('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/></svg>', "kpi-green", "动态条数", diaryN,
					diaryNew > 0 ? '<b class="kpi-num">+' + diaryNew + "</b> 本月新增" : "本月无新增", true, "diary") +
				kpi('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.1 2.1a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>', "kpi-blue", "友链总数", friendN, "本月无新增") +
				kpi('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.8-.4L3 21l1.5-4.4A8.4 8.4 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4h.6a8.4 8.4 0 0 1 8.4 8.4z"/></svg>', "kpi-orange", "评论总数", cmtN,
					'<b class="kpi-num">+' + cmtNew + "</b> 本月新增") +
				"</div>";

			/* 趋势 + 储存分布 */
			html += '<div class="dash-top">';
			html += '<div class="card"><div class="card-head"><h2 class="card-title">站点流量统计</h2><span class="card-sub" style="margin-left:auto">近 31 天 · Umami 分享 API</span></div>';
			html += '<div class="card-body trend-body">';
			if (pv && pv.pageviews && pv.pageviews.length) {
				var series = pv.pageviews.slice(-31);
				var vals = series.map(function (x) { return x.pageviews || 0; });
				var max = Math.max.apply(null, vals.concat([1]));
				var W = 660, H0 = 8, H1 = 158, n = vals.length;
				function y(v) { return H1 - (v / max) * (H1 - H0); }
				var pts = vals.map(function (v, i) { return (i * (W / (n - 1))).toFixed(1) + "," + y(v).toFixed(1); });
				var peakI = 0; vals.forEach(function (v, i) { if (v > vals[peakI]) peakI = i; });
				var px = (peakI * (W / (n - 1))), py = y(vals[peakI]);
				var total = vals.reduce(function (a, b) { return a + b; }, 0);
				html += '<div class="chart-wrap"><div class="chart-yaxis" style="height:148px">' +
					'<span style="top:7px">' + max + "</span><span style=\"top:72px\">" + Math.round(max / 2) + '</span><span style="top:138px">0</span></div>' +
					'<div class="chart" style="height:148px"><div class="chart-area"><svg viewBox="0 0 660 170" preserveAspectRatio="none" role="img" aria-label="近 31 天逐日浏览量">' +
					'<defs><linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".30"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
					'<line x1="0" y1="8" x2="660" y2="8" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>' +
					'<line x1="0" y1="83" x2="660" y2="83" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>' +
					'<line x1="0" y1="158" x2="660" y2="158" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
					'<path d="M' + pts.join(" L") + " L660,158 L0,158 Z\" fill=\"url(#dashArea)\"/>" +
					'<path d="M' + pts.join(" L") + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
					"</svg>";
				var dots = "";
				vals.forEach(function (v, i) {
					dots += '<i class="pt-dot" style="left:' + (i / (n - 1) * 100).toFixed(2) + "%;top:" + (y(v) / 170 * 100).toFixed(2) + '%" title="' + fmtDate(series[i].timestamp || Date.now()) + " · " + v + '"></i>';
				});
				html += dots;
				html += '<i class="cm-dot" style="left:' + (px / W * 100).toFixed(2) + "%;top:" + (py / 170 * 100).toFixed(2) + '%"></i>' +
					'<span class="cm-lb" style="left:' + Math.min(80, px / W * 100).toFixed(2) + "%;top:" + Math.max(2, py / 170 * 100 - 6).toFixed(2) + '%">峰值 ' + fmtDate(series[peakI].timestamp || Date.now()) + " · " + vals[peakI] + "</span>";
				html += "</div></div>";
				html += '<div class="chart-xaxis"><span>' + fmtDate(series[0].timestamp || Date.now()) + "</span><span>" + fmtDate(series[Math.floor(n / 2)].timestamp || Date.now()) + "</span><span>" + fmtDate(series[n - 1].timestamp || Date.now()) + "</span></div>";
				html += '<div class="chart-foot"><span>31 天合计 <b class="num">' + total.toLocaleString() + "</b> PV</span><span>日均 <b class=\"num\">" + Math.round(total / n) + "</b></span></div>";
			} else {
				html += '<div class="empty-block">暂时拿不到 Umami 数据（未配置或接口不可用）</div>';
			}
			html += "</div></div>";

			html += renderDonut(tree);
			html += "</div>";

			/* 评论 + 提交 */
			html += '<div class="dash-2col" style="margin-top:14px"><div>';
			html += '<div class="card"><div class="card-head"><h2 class="card-title">最新评论</h2><button class="cmt-all" type="button" id="cmtAllBtn">查看全部</button></div><div class="cmt-list">';
			if (comments && comments.length) {
				comments.slice(0, 3).forEach(function (c) {
					html += cmtItemHtml(c, true);
				});
			} else html += '<div class="empty-block">暂无评论</div>';
			html += "</div></div></div><div>";
			html += '<div class="card"><div class="card-head"><h2 class="card-title">最近提交</h2><button class="cmt-all" type="button" id="depAllBtn" title="打开 Vercel 构建历史">查看全部</button></div>';
			if (commits && commits.length) {
				commits.forEach(function (c, i) {
					var d = new Date((c.commit.committer || c.commit.author || {}).date);
					html += '<div class="row" style="align-items:flex-start"><div class="row-k">' +
						'<div class="list-t clamp2">' + esc(c.commit.message.split("\n")[0]) + "</div>" +
						'<div class="list-s mono">' + esc(c.sha.slice(0, 8)) + " · " + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + " · " + esc(c.commit.author.name) + "</div>" +
						"</div>" + (i === 0 ? '<div class="row-v"><span class="pill">最新</span></div>' : "") + "</div>";
				});
			} else html += '<div class="empty-block">暂无提交记录</div>';
			var nStaged = Object.keys(STAGED).length;
			html += '<div class="card-body" style="border-top:1px solid var(--line-soft);font-size:12px;color:var(--ink-3);line-height:1.7">当前暂存区 <b class="num">' + nStaged + '</b> 项待推送。推送后自动触发 Vercel 构建。</div>';
			html += "</div></div></div>";

			setView("dash", html);
			bindDash();
		});
	}
	function cmtItemHtml(c, clickable) {
		var url = c.url || "/";
		var src = url === "/guestbook/" ? "留言板" : url.indexOf("/posts/") === 0 ? "文章" : url === "/about/" ? "关于" : url === "/friends/" ? "友链" : url === "/anime/" ? "追番" : url === "/diary/" || url.indexOf("/diary") === 0 ? "动态" : url;
		var tmp = document.createElement("div"); tmp.innerHTML = c.comment || "";
		var txt = (tmp.textContent || "").replace(/\s+/g, " ").trim();
		return '<div class="cmt-item"' + (clickable ? ' data-url="' + esc(url) + '" title="点击打开该评论所在的页面"' : "") + ">" +
			'<img class="cmt-avatar" src="' + esc(c.avatar || "") + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
			'<div class="cmt-main"><div class="cmt-top"><span class="cmt-nm">' + esc(c.nick || "匿名") + '</span><span class="cmt-time">' + relTime(c.created) + "</span></div>" +
			'<div class="cmt-txt">' + esc(txt.slice(0, 120)) + "</div>" +
			'<div class="cmt-src">评论于《' + esc(src) + "》</div></div></div>";
	}
	function renderDonut(tree) {
		if (!tree || !tree.tree) return '<div class="card don-card"><div class="card-head"><h2 class="card-title">站点储存分布</h2></div><div class="card-body don-body"><div class="empty-block">暂时拿不到 Git 树数据</div></div></div>';
		var buckets = [
			{ key: "posts", nm: "内容仓 · 文章", test: function (p) { return p.indexOf("posts/") === 0; }, color: "var(--tint-green-fg)" },
			{ key: "images", nm: "内容仓 · 相册与图片", test: function (p) { return p.indexOf("images/") === 0; }, color: "var(--tint-blue-fg)" },
			{ key: "data", nm: "内容仓 · 数据与配置", test: function (p) { return p.indexOf("data/") === 0 || p.indexOf("settings/") === 0 || p.indexOf("spec/") === 0 || p.indexOf("assets/") === 0; }, color: "var(--tint-orange-fg)" },
			{ key: "site", nm: "站点仓（只读参照）", test: function (p) { return p.indexOf("site:") === 0; }, color: "var(--tint-purple-fg)" },
		];
		var sums = [0, 0, 0, 0];
		(tree.tree || []).forEach(function (t) {
			if (t.type !== "blob" || !t.size) return;
			for (var i = 0; i < buckets.length; i++) if (buckets[i].test(t.path)) { sums[i] += t.size; return; }
		});
		var total = sums.reduce(function (a, b) { return a + b; }, 0) || 1;
		var C = 2 * Math.PI * 54, off = 0, circles = "", legend = "";
		sums.forEach(function (s, i) {
			if (!s) return;
			var frac = s / total, len = frac * C;
			circles += '<circle cx="75" cy="75" r="54" fill="none" stroke="' + buckets[i].color + '" stroke-width="15" stroke-dasharray="' + len.toFixed(2) + " " + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"><title>' + esc(buckets[i].nm + " " + fmtMB(s) + " / " + (frac * 100).toFixed(1) + "%") + "</title></circle>";
			legend += '<li class="don-item"><i class="don-dot" style="background:' + buckets[i].color + '"></i><span class="don-nm">' + esc(buckets[i].nm) + '</span><span class="don-sz num">' + fmtMB(s) + '</span><span class="don-pc num">' + (frac * 100).toFixed(1) + "%</span></li>";
			off += len;
		});
		return '<div class="card don-card"><div class="card-head"><h2 class="card-title">站点储存分布</h2><span class="card-sub" style="margin-left:auto">内容仓 Git 树实测</span></div>' +
			'<div class="card-body don-body"><div class="donut"><svg viewBox="0 0 150 150"><g transform="rotate(-90 75 75)">' + circles + '</g></svg>' +
			'<div class="don-center"><b class="num">' + (total / 1048576).toFixed(1) + "</b><span>MB 合计</span></div></div>" +
			'<ul class="don-legend">' + legend + "</ul></div></div>";
	}
	function bindDash() {
		var v = $("#v-dash");
		$("#dashRefresh", v).addEventListener("click", function () {
			CACHE.comments = null; CACHE.posts = null;
			Object.keys(CACHE).forEach(function (k) { if (k.indexOf("ts:") === 0) delete CACHE[k]; });
			renderDash(); toast("已刷新");
		});
		var cAll = $("#cmtAllBtn", v); if (cAll) cAll.addEventListener("click", function () { go("comments"); });
		var dAll = $("#depAllBtn", v); if (dAll) dAll.addEventListener("click", function () { window.open(VERCEL_DEPLOY, "_blank", "noopener"); });
		$$(".cmt-item[data-url]", v).forEach(function (it) {
			it.addEventListener("click", function () {
				if (confirm("打开该评论所在的页面？")) window.open(SITE_URL + it.getAttribute("data-url"), "_blank", "noopener");
			});
		});
		var kpiPost = $('[data-kpi="post"]', v);
		if (kpiPost) {
			kpiPost.addEventListener("click", function () { go("posts"); openPost(null); });
			bindMdDrop(kpiPost);
		}
		var kpiDiary = $('[data-kpi="diary"]', v);
		if (kpiDiary) kpiDiary.addEventListener("click", function () { go("diary"); addDiaryItem(); });
	}

	/* ================= 文章管理 ================= */
	var POSTS = { items: [], current: null };
	function postCategoryOf(path) {
		var m = /^posts\/([^/]+)\/[^/]+\.md$/.exec(path);
		return m ? m[1] : "未分类";
	}
	function renderPosts() {
		return loadPostsWithMeta().then(function (items) {
			POSTS.items = items;
			var groups = {};
			items.forEach(function (p) {
				var c = postCategoryOf(p.file.path);
				(groups[c] = groups[c] || []).push(p);
			});
			var cats = Object.keys(groups);
			var html = pageHead('<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h11l5 5v11H4z"/><path d="M15 4v5h5"/></svg>',
				"文章管理", '<span class="mono">content/posts/</span> · ' + items.length + " 篇 · " + cats.length + " 个分类",
				'<button class="btn" type="button" id="postUpload">⬆ 上传 .md</button><button class="btn btn-primary" type="button" id="postNew">+ 新建文章</button>');
			html += '<div class="split"><div class="card split-list"><div>';
			cats.forEach(function (c) {
				html += '<div class="nav-group-head" style="cursor:default"><span class="nav-label">' + esc(c) + " · " + groups[c].length + '</span></div>';
				groups[c].forEach(function (p) {
					var t = p.fm.title || p.file.name;
					var d = String(p.fm.published || "").slice(0, 10);
					html += '<div class="list-item" data-post="' + esc(p.file.path) + '"><div class="list-main"><div class="list-t">' + esc(t) + '</div><div class="list-s">' + esc(d) + (p.fm.draft ? ' · <span class="pill warn" style="padding:0 6px">草稿</span>' : "") + (p.fm.pinned ? ' · <span class="pill accent" style="padding:0 6px">置顶</span>' : "") + "</div></div></div>";
				});
			});
			html += '</div></div><div id="postPanel">' + '<div class="card"><div class="card-body"><div class="empty-block">从左侧选择一篇文章开始编辑；或点右上角「新建文章」。</div></div></div></div></div>';
			setView("posts", html);
			$("#postNew").addEventListener("click", function () { newPost(); });
			$("#postUpload").addEventListener("click", function () { uploadMdFile(); });
			$$("#v-posts .list-item[data-post]").forEach(function (it) {
				it.addEventListener("click", function () {
					$$("#v-posts .list-item").forEach(function (x) { x.classList.remove("on"); });
					it.classList.add("on");
					var f = POSTS.items.filter(function (p) { return p.file.path === it.getAttribute("data-post"); })[0];
					if (f) openPost(f);
				});
			});
		}).catch(function (e) { setView("posts", errBox(e.message)); });
	}
	function openPost(p) {
		var panel = $("#postPanel"); if (!panel) return;
		if (!p) {
			var drafts = POSTS.items.filter(function (x) { return !x.sha; });
			p = drafts[0] || null;
			if (!p) { panel.innerHTML = '<div class="card"><div class="card-body"><div class="empty-block">从左侧选择一篇文章开始编辑。</div></div></div>'; return; }
		}
		POSTS.current = p;
		var s = window.getSchema("post");
		var card = el("div", "card");
		card.innerHTML = '<div class="card-head"><h2 class="card-title">' + esc(p.fm.title || p.file.name) + '</h2><span class="pill mono">' + esc(p.file.path.replace(/^posts\//, "")) + "</span></div>";
		var body = el("div", "card-body");
		var fields = el("div", "ef-fields");
		fields.appendChild(FORM.renderFields(s.fields, p.fm, function () { }));
		body.appendChild(fields);
		/* 正文编辑 + 实时预览 */
		var bw = el("div", "ef-field");
		bw.appendChild(el("label", "ef-label", "正文（Markdown）— 右侧实时预览"));
		var toolbar = el("div", "ef-toolbar");
		var imgBtn = el("button", "ef-btn ef-btn-sm", "🖼 上传图片到图床");
		imgBtn.addEventListener("click", function () {
			if (!window.EditorImgBed) { alert("图床模块未加载"); return; }
			window.EditorImgBed.pickAndUpload(function (u) { insertAtCursor(ta, "![](" + u + ")\n"); renderPrev(); });
		});
		toolbar.appendChild(imgBtn);
		bw.appendChild(toolbar);
		var cols = el("div", "ef-body-cols");
		var ta = document.createElement("textarea");
		ta.className = "ef-input ef-textarea ef-body";
		ta.value = p.body || "";
		var prev = el("div", "ef-body-preview");
		var _md = null;
		function getMd() { if (!_md && window.markdownit) _md = window.markdownit({ html: true, linkify: true, typographer: true }); return _md; }
		function renderPrev() {
			p.body = ta.value;
			var md = getMd();
			prev.innerHTML = md ? md.render(ta.value || "") : "";
		}
		ta.addEventListener("input", renderPrev);
		ta.addEventListener("change", function () { p.body = ta.value; });
		cols.appendChild(ta); cols.appendChild(prev);
		bw.appendChild(cols);
		body.appendChild(bw);
		renderPrev();
		/* 操作 */
		var acts = el("div", null);
		acts.style.cssText = "display:flex;gap:8px;margin-top:14px";
		var save = el("button", "btn btn-primary", "💾 存入暂存区");
		save.addEventListener("click", function () { savePost(p); });
		var open = el("button", "btn", "在线查看");
		open.addEventListener("click", function () {
			var u = p.fm.permalink ? SITE_URL + "/" + p.fm.permalink + "/" : SITE_URL + "/posts/" + p.file.name.replace(/\.md$/, "") + "/";
			window.open(u, "_blank", "noopener");
		});
		var del = el("button", "btn btn-danger", "🗑 删除");
		del.addEventListener("click", function () {
			if (!confirm("确认删除「" + (p.fm.title || p.file.name) + "」？删除将在统一推送时生效")) return;
			stageDelete(p.file.path, "删除文章");
			POSTS.items = POSTS.items.filter(function (x) { return x !== p; });
			renderPosts();
		});
		acts.appendChild(save); acts.appendChild(open);
		var sp = el("span"); sp.style.flex = "1"; acts.appendChild(sp);
		acts.appendChild(del);
		body.appendChild(acts);
		card.appendChild(body);
		panel.innerHTML = "";
		panel.appendChild(card);
	}
	function savePost(p) {
		var s = window.getSchema("post");
		var base = (p.file.path.split("/").pop() || "").replace(/\.md$/, "");
		if (typeof p.fm.permalink !== "string" || !p.fm.permalink) p.fm.permalink = base;
		var newSource = MDM.stringify(p.fm, p.body);
		var cat = String(p.fm.category || "").replace(/[\/\\:*?"<>|]/g, "").trim();
		var fname = p.file.path.split("/").pop();
		var targetPath = cat ? "posts/" + cat + "/" + fname : "posts/" + fname;
		showDiff(p.raw, newSource, function () {
			if (targetPath !== p.file.path) {
				if (p.sha) {
					stageDelete(p.file.path, "移动文章");
					stagePut(targetPath, newSource, "移动文章");
				} else {
					unstage(p.file.path);
					stagePut(targetPath, newSource, "新建文章");
				}
				p.file.path = targetPath;
				p.file.name = fname;
			} else {
				stagePut(targetPath, newSource, "更新文章");
			}
			p.raw = newSource;
		});
	}
	function newPost() {
		var title = prompt("文章标题：");
		if (!title) return;
		var slug = MDM.slugify(title) || "post";
		var t = today();
		var filename = t + "-" + slug + ".md";
		var content = '---\ntitle: "' + title.replace(/"/g, '\\"') + '"\npublished: ' + t + "\ndraft: true\ntags: []\ncategory: \"\"\npermalink: " + filename.replace(/\.md$/, "") + "\ncomment: true\n---\n\n# " + title + "\n";
		var path = "posts/" + filename;
		var p = { file: { name: filename, path: path, type: "file" }, sha: null, fm: MDM.parse(content).data, body: MDM.parse(content).body, raw: content };
		POSTS.items.unshift(p);
		CACHE.posts = null;
		renderPosts().then(function () {
			var it = $('#v-posts .list-item[data-post="' + path.replace(/"/g, "&quot;") + '"]');
			if (it) it.click();
		});
		toast("已创建本地草稿（推送后生效）");
	}
	function uploadMdFile() {
		var input = document.createElement("input");
		input.type = "file";
		input.accept = ".md,.markdown,text/markdown,text/plain";
		input.addEventListener("change", function () {
			var file = input.files && input.files[0];
			if (!file) return;
			var reader = new FileReader();
			reader.onload = function () {
				var raw = String(reader.result || "");
				var parsed = MDM.parse(raw);
				var fm = parsed.data || {};
				var title = typeof fm.title === "string" ? fm.title : file.name.replace(/\.(md|markdown)$/i, "");
				var slug = MDM.slugify(title) || file.name.replace(/\.(md|markdown)$/i, "");
				var t = today();
				var filename = t + "-" + slug + ".md";
				if (!fm.title) fm.title = title;
				if (!fm.published) fm.published = t;
				if (typeof fm.draft !== "boolean") fm.draft = true;
				if (!Array.isArray(fm.tags)) fm.tags = [];
				var cat = String(fm.category || "").replace(/[\/\\:*?"<>|]/g, "").trim();
				var path = cat ? "posts/" + cat + "/" + filename : "posts/" + filename;
				var p = { file: { name: filename, path: path, type: "file" }, sha: null, fm: fm, body: parsed.body || "", raw: MDM.stringify(fm, parsed.body || "") };
				POSTS.items.unshift(p);
				CACHE.posts = null;
				renderPosts();
				toast("已导入：" + title + "（推送后生效）");
			};
			reader.readAsText(file);
		});
		input.click();
	}
	function bindMdDrop(host) {
		host.addEventListener("dragover", function (e) { e.preventDefault(); host.classList.add("drop-hot"); });
		host.addEventListener("dragleave", function () { host.classList.remove("drop-hot"); });
		host.addEventListener("drop", function (e) {
			e.preventDefault(); host.classList.remove("drop-hot");
			var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
			if (f && /\.md$/i.test(f.name)) {
				go("posts");
				setTimeout(function () { uploadMdFile(); }, 60);
			}
		});
	}

	/* ================= 通用数据页（schema 驱动） ================= */
	var DATA = {};
	function renderDataPage(key) {
		var s = window.getSchema(key);
		if (!s) { setView(key, errBox("未知数据页：" + key)); return Promise.resolve(); }
		var st = DATA[key] = { schema: s, rawSource: "", rawSha: "", items: [], current: null, data: null };
		setView(key, loading("正在读取 " + s.path + " …"));
		var chain;
		if (s.format === "md-file") {
			chain = GIT.getFile(s.owner, s.repo, s.path, s.branch).then(function (f) {
				if (!f) throw new Error("文件不存在：" + s.path);
				st.rawSource = f.content; st.rawSha = f.sha;
				var p = MDM.parse(f.content);
				st.data = p.data; st.body = p.body;
			});
		} else {
			chain = getTs(s).then(function (c) {
				st.rawSource = c.raw; st.rawSha = c.sha;
				if (s.format === "ts-map") {
					st.items = Object.keys(c.value).map(function (k) { return { key: k, items: c.value[k] }; });
				} else if (Array.isArray(c.value)) {
					st.items = c.value;
					if (s.format === "ts-array" && c.value.length && "date" in c.value[0]) {
						st.items = c.value.slice().sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
					}
				} else st.items = [c.value];
			});
		}
		return chain.then(function () {
			var html = pageHead('<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
				s.label + "管理", '<span class="mono">content/' + esc(s.path) + "</span>",
				(s.format !== "md-file" ? '<button class="btn btn-primary" type="button" data-add>+ 新增</button>' : ""));
			html += '<div class="split"><div class="card split-list"><div data-list></div></div><div data-panel></div></div>';
			setView(key, html);
			var addBtn = $('[data-add]', $("#v-" + key));
			if (addBtn) addBtn.addEventListener("click", function () { dataAdd(key); });
			dataRenderList(key);
			if (st.items.length) dataSelect(key, 0);
			else if (s.format === "md-file") dataRenderPanel(key);
			if (s.batchMd) {
				var listCard = $("#v-" + key + " [data-list]");
				var up = el("button", "ef-btn ef-btn-block", "⬆ 批量上传 .md 文档");
				up.addEventListener("click", function () { uploadMdBatch(key); });
				listCard.parentNode.insertBefore(up, listCard);
			}
		}).catch(function (e) { setView(key, errBox(e.message)); });
	}
	function dataLabel(s, it, i) {
		if (typeof s.itemLabel === "function") return s.itemLabel(it);
		if (s.format === "ts-map") return it.key;
		var v = it[s.itemLabel];
		if (v !== undefined && v !== null && v !== "") return String(v);
		return "#" + (i + 1);
	}
	function dataRenderList(key) {
		var st = DATA[key], s = st.schema;
		var box = $("#v-" + key + " [data-list]");
		if (!box) return;
		box.innerHTML = "";
		st.items.forEach(function (it, i) {
			var row = el("div", "list-item");
			row.innerHTML = '<div class="list-main"><div class="list-t">' + esc(dataLabel(s, it, i)).slice(0, 60) + "</div></div>";
			row.addEventListener("click", function () {
				$$("#v-" + key + " .list-item").forEach(function (x) { x.classList.remove("on"); });
				row.classList.add("on");
				dataSelect(key, i);
			});
			box.appendChild(row);
		});
		if (!st.items.length) box.innerHTML = '<div class="empty-block">暂无数据，点右上角「+ 新增」</div>';
	}
	function dataSelect(key, i) {
		var st = DATA[key], s = st.schema;
		st.current = st.items[i];
		dataRenderPanel(key);
	}
	function dataRenderPanel(key) {
		var st = DATA[key], s = st.schema;
		var panel = $("#v-" + key + " [data-panel]");
		if (!panel) return;
		panel.innerHTML = "";
		var card = el("div", "card");
		var head = el("div", "card-head");
		var title = s.format === "md-file" ? s.label : dataLabel(s, st.current, 0);
		head.innerHTML = '<h2 class="card-title">' + esc(String(title).slice(0, 40)) + "</h2>";
		card.appendChild(head);
		var body = el("div", "card-body");
		var fields = el("div", "ef-fields");
		if (s.format === "md-file") {
			fields.appendChild(FORM.renderFields(s.fields, st.data, function () { }));
			body.appendChild(fields);
			body.appendChild(mdEditor(st, "body", function () { }));
		} else if (s.format === "ts-map") {
			body.appendChild(mapEditor(key, st.current));
		} else {
			fields.appendChild(FORM.renderFields(s.fields, st.current, function () { }));
			body.appendChild(fields);
		}
		var acts = el("div", null);
		acts.style.cssText = "display:flex;gap:8px;margin-top:14px";
		var save = el("button", "btn btn-primary", "💾 存入暂存区");
		save.addEventListener("click", function () { dataSave(key); });
		acts.appendChild(save);
		if (s.format !== "md-file") {
			var del = el("button", "btn btn-danger", "🗑 删除");
			del.addEventListener("click", function () { dataDelete(key); });
			var sp = el("span"); sp.style.flex = "1";
			acts.appendChild(sp); acts.appendChild(del);
		}
		body.appendChild(acts);
		card.appendChild(body);
		panel.appendChild(card);
	}
	function mdEditor(st, bodyKey) {
		var wrap = el("div", "ef-field");
		wrap.appendChild(el("label", "ef-label", "正文（Markdown）— 右侧实时预览"));
		var cols = el("div", "ef-body-cols");
		var ta = document.createElement("textarea");
		ta.className = "ef-input ef-textarea ef-body";
		ta.value = st[bodyKey] || "";
		var prev = el("div", "ef-body-preview");
		var _md = window.markdownit ? window.markdownit({ html: true, linkify: true, typographer: true }) : null;
		function rp() { st[bodyKey] = ta.value; prev.innerHTML = _md ? _md.render(ta.value || "") : ""; }
		ta.addEventListener("input", rp);
		cols.appendChild(ta); cols.appendChild(prev);
		wrap.appendChild(cols);
		setTimeout(rp, 0);
		return wrap;
	}
	function mapEditor(key, cat) {
		var st = DATA[key], s = st.schema;
		var wrap = el("div", "ef-object-list");
		function rerender() {
			wrap.innerHTML = "";
			var nameField = el("div", "ef-field");
			nameField.appendChild(el("label", "ef-label", "分类名称"));
			var nameInput = el("input", "ef-input");
			nameInput.value = cat.key;
			nameInput.addEventListener("change", function () {
				var nk = nameInput.value.trim();
				if (!nk || nk === cat.key) return;
				cat.key = nk;
			});
			nameField.appendChild(nameInput);
			wrap.appendChild(nameField);
			cat.items.forEach(function (dev, di) {
				var row = el("div", "ef-ol-item");
				var head = el("div", "ef-ol-head");
				head.appendChild(el("span", "ef-ol-title", dev.name || "设备 " + (di + 1)));
				var del = el("button", "ef-btn ef-btn-danger ef-btn-sm", "删除");
				del.addEventListener("click", function () { cat.items.splice(di, 1); rerender(); });
				head.appendChild(del);
				row.appendChild(head);
				var body = el("div", "ef-ol-body");
				s.fields.forEach(function (f) { body.appendChild(FORM.renderField(f, dev, function () { })); });
				row.appendChild(body);
				wrap.appendChild(row);
			});
			var add = el("button", "ef-btn ef-btn-sm", "+ 添加设备");
			add.addEventListener("click", function () {
				var dev = {};
				s.fields.forEach(function (f) { dev[f.key] = f.type === "tags" ? [] : ""; });
				cat.items.push(dev);
				rerender();
			});
			wrap.appendChild(add);
		}
		rerender();
		return wrap;
	}
	function dataAdd(key) {
		var st = DATA[key], s = st.schema;
		if (s.format === "ts-map") {
			var name = prompt("分类名称（如 手机 / 电脑 / 相机）：");
			if (!name || !name.trim()) return;
			if (st.items.some(function (c) { return c.key === name.trim(); })) { alert("分类已存在"); return; }
			st.items.push({ key: name.trim(), items: [] });
			dataRenderList(key);
			return;
		}
		if (s.format === "ts-array") {
			var it = {};
			s.fields.forEach(function (f) {
				if (f.hidden) return;
				if (f.type === "boolean") it[f.key] = false;
				else if (f.type === "tags" || f.type === "object-list") it[f.key] = [];
				else if (f.type === "object") it[f.key] = {};
				else if (f.key === "date" || f.key === "published") it[f.key] = nowISO();
				else it[f.key] = "";
			});
			s.fields.forEach(function (f) {
				if (f.hidden && f.key === "id" && f.type === "number") {
					var maxId = 0;
					st.items.forEach(function (e) { if (e && typeof e.id === "number" && e.id > maxId) maxId = e.id; });
					it.id = maxId + 1;
				}
			});
			st.items.push(it);
			st.current = it;
			dataRenderList(key);
			dataRenderPanel(key);
		}
	}
	function addDiaryItem() {
		if (!DATA.diary) { renderDataPage("diary").then(function () { setTimeout(function () { dataAdd("diary"); }, 120); }); return; }
		go("diary");
		setTimeout(function () { dataAdd("diary"); }, 120);
	}
	function dataSave(key) {
		var st = DATA[key], s = st.schema;
		try {
			var newSource;
			if (s.format === "md-file") {
				newSource = MDM.stringify(st.data, st.body);
			} else if (s.format === "ts-map") {
				var map = {};
				st.items.forEach(function (c) { map[c.key] = c.items; });
				newSource = TSIO.replace(st.rawSource, s.varName, map);
			} else {
				newSource = TSIO.replace(st.rawSource, s.varName, s.format === "ts-array" ? st.items : st.data);
			}
			if (newSource === null) throw new Error("生成源码失败");
			if (st.rawSha && s.bom && newSource.charAt(0) !== "﻿") newSource = "﻿" + newSource;
			showDiff(st.rawSource, newSource, function () {
				st.rawSource = newSource;
				stagePut(s.path, newSource, s.label);
			});
		} catch (e) {
			alert("保存前校验失败：" + e.message);
		}
	}
	function dataDelete(key) {
		var st = DATA[key], s = st.schema;
		var label = dataLabel(s, st.current, 0);
		if (!confirm("确认删除「" + label + "」？删除将在统一推送时生效")) return;
		if (s.format === "ts-array") {
			var idx = st.items.indexOf(st.current);
			if (idx > -1) st.items.splice(idx, 1);
		}
		var newSource = TSIO.replace(st.rawSource, s.varName, s.format === "ts-array" ? st.items : st.data);
		st.rawSource = newSource;
		stagePut(s.path, newSource, s.label);
		dataRenderList(key);
		dataRenderPanel(key);
	}
	function uploadMdBatch(key) {
		var st = DATA[key], s = st.schema;
		var input = document.createElement("input");
		input.type = "file"; input.multiple = true;
		input.accept = ".md,.markdown,text/markdown,text/plain";
		input.addEventListener("change", function () {
			var files = input.files ? Array.prototype.slice.call(input.files) : [];
			var done = 0, added = 0, skipped = 0;
			files.forEach(function (file) {
				var reader = new FileReader();
				reader.onload = function () {
					var raw = String(reader.result || "");
					var fname = file.name.replace(/\.(md|markdown)$/i, "");
					var d = (fname.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
					var h = d || today();
					if (st.items.some(function (it) { return it && it.h === h; })) skipped++;
					else { st.items.push({ h: h, body: raw.replace(/^\n+/, "") }); added++; }
					done++;
					if (done >= files.length) {
						st.items.sort(function (a, b) { return String(a.h || "").localeCompare(String(b.h || "")); });
						dataRenderList(key);
						toast("已加入 " + added + " 篇，跳过重复 " + skipped + " 篇（存入暂存区后统一推送）");
					}
				};
				reader.readAsText(file);
			});
		});
		input.click();
	}

	/* ================= 站点与外观（9 settings · 通用递归表单） ================= */
	var SETTINGS_FILES = ["site", "hero", "navbar", "footer", "profile", "comment", "music", "wallpaper", "license"];
	var SETTINGS_LABELS = { site: "基础信息", hero: "首屏 Hero", navbar: "导航栏", footer: "页脚", profile: "个人资料", comment: "评论系统", music: "音乐播放器", wallpaper: "背景壁纸", license: "版权许可" };
	var SET = { tab: "site", cache: {} };
	function inferFields(v) {
		var fields = [];
		if (!v || typeof v !== "object") return fields;
		Object.keys(v).forEach(function (k) {
			var val = v[k];
			var f = { key: k, label: k };
			if (typeof val === "boolean") f.type = "boolean";
			else if (typeof val === "number") f.type = "number";
			else if (Array.isArray(val)) {
				if (val.length === 0 || val.every(function (x) { return typeof x !== "object"; })) f.type = "tags";
				else {
					f.type = "object-list";
					f.itemLabel = "title";
					var itemFields = [], seen = {};
					val.forEach(function (item) {
						inferFields(item).forEach(function (sf) {
							if (!seen[sf.key]) { seen[sf.key] = 1; itemFields.push(sf); }
						});
					});
					f.itemFields = itemFields;
				}
			} else if (val && typeof val === "object") {
				f.type = "object";
				f.fields = inferFields(val);
			} else {
				f.type = String(val || "").length > 60 || String(val).indexOf("\n") >= 0 ? "text" : "string";
			}
			fields.push(f);
		});
		return fields;
	}
	function renderSettings() {
		var tabs = SETTINGS_FILES.map(function (f) {
			return '<button class="tab' + (SET.tab === f ? " on" : "") + '" data-tab="' + f + '">' + esc(SETTINGS_LABELS[f]) + "</button>";
		}).join("");
		setView("settings", pageHead('<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
			"站点与外观", '<span class="mono">content/settings/</span> · 9 个配置文件',
			'<button class="btn btn-primary" type="button" id="setSave">💾 存入暂存区</button>') +
			'<div class="set-tabs">' + tabs + '</div><div id="setBody">' + loading() + "</div>");
		$$("#v-settings .set-tabs .tab").forEach(function (t) {
			t.addEventListener("click", function () {
				SET.tab = t.getAttribute("data-tab");
				renderSettings();
			});
		});
		$("#setSave").addEventListener("click", saveSettings);
		loadSettingsTab(SET.tab);
	}
	function settingsVarName(source, file) {
		var m = /export\s+default\s+(\w+)\s*;?/.exec(source);
		if (m) return m[1];
		m = new RegExp("const\\s+(\\w+)\\s*[:=]", "m").exec(source);
		return m ? m[1] : file;
	}
	function loadSettingsTab(file) {
		var box = $("#setBody");
		if (SET.cache[file]) { paintSettings(file, box); return; }
		box.innerHTML = loading("正在读取 settings/" + file + ".ts …");
		GIT.getFile(OWNER, REPO, "settings/" + file + ".ts", BRANCH).then(function (f) {
			if (!f) throw new Error("文件不存在：settings/" + file + ".ts");
			var varName = settingsVarName(f.content, file);
			var v = TSIO.extract(f.content, varName);
			if (v === null) throw new Error("无法解析 settings/" + file + ".ts（" + varName + "）");
			SET.cache[file] = { raw: f.content, sha: f.sha, varName: varName, value: v };
			paintSettings(file, box);
		}).catch(function (e) { box.innerHTML = errBox(e.message); });
	}
	function paintSettings(file, box) {
		var c = SET.cache[file];
		box.innerHTML = "";
		var card = el("div", "card");
		card.innerHTML = '<div class="card-head"><h2 class="card-title">' + esc(SETTINGS_LABELS[file]) + '</h2><span class="pill mono">settings/' + esc(file) + ".ts</span></div>";
		var body = el("div", "card-body");
		var fields = el("div", "ef-fields");
		fields.appendChild(FORM.renderFields(inferFields(c.value), c.value, function () { }));
		body.appendChild(fields);
		card.appendChild(body);
		box.appendChild(card);
	}
	function saveSettings() {
		var c = SET.cache[SET.tab];
		if (!c) { alert("当前标签尚未加载完成"); return; }
		var newSource = TSIO.replace(c.raw, c.varName, c.value);
		if (newSource === null) { alert("生成源码失败"); return; }
		showDiff(c.raw, newSource, function () {
			c.raw = newSource;
			stagePut("settings/" + SET.tab + ".ts", newSource, SETTINGS_LABELS[SET.tab]);
		});
	}

	/* ================= 全部评论 ================= */
	function renderComments() {
		setView("comments", pageHead('<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.8-.4L3 21l1.5-4.4A8.4 8.4 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4h.6a8.4 8.4 0 0 1 8.4 8.4z"/></svg>',
			"全部评论", "Twikoo 全站评论 · 实时拉取") + '<div class="card"><div class="cmt-list" id="cmtFull">' + loading() + "</div></div>");
		twikooRecent().then(function (list) {
			var box = $("#cmtFull");
			box.innerHTML = list.map(function (c) { return cmtItemHtml(c, true); }).join("") || '<div class="empty-block">暂无评论</div>';
			$$("#cmtFull .cmt-item[data-url]").forEach(function (it) {
				it.addEventListener("click", function () {
					if (confirm("打开该评论所在的页面？")) window.open(SITE_URL + it.getAttribute("data-url"), "_blank", "noopener");
				});
			});
		}).catch(function (e) { $("#cmtFull").innerHTML = errBox(e.message); });
	}

	/* ================= 网站统计 ================= */
	function renderStats() {
		setView("stats", pageHead('<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15v-4M12 15V7M17 15v-7"/></svg>',
			"网站统计", "Umami 分享 API · 近 30 天") + '<div id="statsBody">' + loading() + "</div>");
		var start = Date.now() - 30 * 86400000, end = Date.now();
		Promise.all([
			umami("/stats", "startAt=" + start + "&endAt=" + end),
			umami("/metrics", "startAt=" + start + "&endAt=" + end + "&type=path&limit=10").catch(function () { return null; }),
			twikooRecent().catch(function () { return null; }),
		]).then(function (rs) {
			var s = rs[0] || {}, m = rs[1], comments = rs[2];
			var html = '<div class="stat-row" style="margin-bottom:14px">';
			html += kpiCard("浏览量 PV", (s.pageviews || {}).value !== undefined ? (s.pageviews.value || 0).toLocaleString() : (s.pageviews && !s.pageviews.value ? JSON.stringify(s.pageviews).slice(0, 8) : "—"));
			html += kpiCard("访客 UV", (s.visitors || {}).value !== undefined ? (s.visitors.value || 0).toLocaleString() : "—");
			html += kpiCard("访问次数", (s.visits || {}).value !== undefined ? (s.visits.value || 0).toLocaleString() : "—");
			html += kpiCard("跳出率", (s.bounces || {}).value !== undefined ? (s.bounces.value || 0) + "%" : "—");
			html += "</div>";
			html += '<div class="dash-2col"><div><div class="card"><div class="card-head"><h2 class="card-title">热门页面 Top 10</h2><span class="card-sub" style="margin-left:auto">按 PV</span></div>';
			var rows = (m && (m.path || m.metrics || m)) || [];
			if (Array.isArray(rows) && rows.length) {
				rows.forEach(function (r) {
					html += '<div class="row"><div class="row-k"><div class="list-t mono">' + esc(r.x || r.path || r.url || "?") + '</div></div><div class="row-v"><span class="pill num">' + (r.y || r.pageviews || 0) + "</span></div></div>";
				});
			} else html += '<div class="empty-block">暂无热门页面数据</div>';
			html += "</div></div><div><div class=\"card\"><div class=\"card-head\"><h2 class=\"card-title\">评论分布</h2><span class=\"card-sub\" style=\"margin-left:auto\">按页面</span></div>";
			if (comments) {
				var dist = {};
				comments.forEach(function (c) { var u = c.url || "/"; dist[u] = (dist[u] || 0) + 1; });
				var arr = Object.keys(dist).map(function (u) { return { u: u, n: dist[u] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
				arr.forEach(function (x) {
					html += '<div class="row"><div class="row-k"><div class="list-t mono">' + esc(x.u) + '</div></div><div class="row-v"><span class="pill num">' + x.n + "</span></div></div>";
				});
			} else html += '<div class="empty-block">暂无评论数据</div>';
			html += "</div></div></div>";
			$("#statsBody").innerHTML = html;
		}).catch(function (e) { $("#statsBody").innerHTML = errBox(e.message + "（Umami 分享接口不可用）"); });
	}
	function kpiCard(k, v) {
		return '<div class="card kpi"><div class="kpi-bd"><div class="kpi-k">' + esc(k) + '</div><div class="kpi-v num">' + esc(String(v)) + "</div></div></div>";
	}

	/* ================= 发布状态 / 备份 / 图床 ================= */
	function renderRelease() {
		setView("release", pageHead('<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>',
			"发布状态", "内容仓提交 → Vercel 自动构建",
			'<button class="btn btn-primary" type="button" id="relVercel">打开 Vercel 构建历史</button>') +
			'<div class="card"><div class="card-head"><h2 class="card-title">内容仓最近提交</h2></div><div id="relList">' + loading() + "</div></div>");
		$("#relVercel").addEventListener("click", function () { window.open(VERCEL_DEPLOY, "_blank", "noopener"); });
		ghCommits(REPO, 10).then(function (cs) {
			var html = "";
			cs.forEach(function (c) {
				var d = new Date((c.commit.committer || c.commit.author || {}).date);
				html += '<div class="row" style="align-items:flex-start"><div class="row-k">' +
					'<div class="list-t clamp2">' + esc(c.commit.message.split("\n")[0]) + "</div>" +
					'<div class="list-s mono">' + esc(c.sha.slice(0, 8)) + " · " + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + " · " + esc(c.commit.author.name) + "</div></div></div>";
			});
			$("#relList").innerHTML = html;
		}).catch(function (e) { $("#relList").innerHTML = errBox(e.message); });
	}
	function renderBackup() {
		setView("backup", pageHead('<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
			"数据备份", "内容仓 tags 与提交历史") +
			'<div class="dash-2col"><div><div class="card"><div class="card-head"><h2 class="card-title">Tags</h2></div><div id="bkTags">' + loading() + '</div></div></div><div><div class="card"><div class="card-head"><h2 class="card-title">最近提交</h2></div><div id="bkCommits">' + loading() + "</div></div></div></div>");
		gh("/repos/" + OWNER + "/" + REPO + "/tags?per_page=15").then(function (tags) {
			var html = tags.length ? tags.map(function (t) {
				return '<div class="row"><div class="row-k"><div class="list-t mono">' + esc(t.name) + '</div></div><div class="row-v"><span class="pill mono">' + esc(t.commit.sha.slice(0, 7)) + "</span></div></div>";
			}).join("") : '<div class="empty-block">暂无 tag</div>';
			$("#bkTags").innerHTML = html;
		}).catch(function (e) { $("#bkTags").innerHTML = errBox(e.message); });
		ghCommits(REPO, 10).then(function (cs) {
			var html = cs.map(function (c) {
				var d = new Date((c.commit.committer || c.commit.author || {}).date);
				return '<div class="row"><div class="row-k"><div class="list-t clamp2">' + esc(c.commit.message.split("\n")[0]) + '</div><div class="list-s mono">' + esc(c.sha.slice(0, 8)) + " · " + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "</div></div></div>";
			}).join("");
			$("#bkCommits").innerHTML = html;
		}).catch(function (e) { $("#bkCommits").innerHTML = errBox(e.message); });
	}
	function renderCfbed() {
		setView("cfbed", pageHead('<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .42-8.98 6.5 6.5 0 0 0-12.7 1.74A4 4 0 0 0 6 19.5z"/></svg>',
			"CF 图床", "cfbed.sanyue.de · 服务端代理（需配置 CFBED_TOKEN）",
			'<button class="btn btn-primary" type="button" id="bedUp">⬆ 上传图片</button>') +
			'<div class="card"><div class="card-head"><h2 class="card-title">图床文件</h2></div><div id="bedList">' + loading() + "</div></div>");
		$("#bedUp").addEventListener("click", function () {
			var input = document.createElement("input");
			input.type = "file"; input.accept = "image/*";
			input.addEventListener("change", function () {
				var f = input.files && input.files[0];
				if (!f) return;
				toast("上传中…");
				f.arrayBuffer().then(function (buf) {
					return fetch("/api/imgbed", {
						method: "POST",
						headers: { "Content-Type": f.type || "application/octet-stream", "X-Filename": encodeURIComponent(f.name) },
						body: buf,
						credentials: "same-origin",
					}).then(function (r) { return r.json(); });
				}).then(function (j) {
					if (!j.ok) throw new Error(j.error || "上传失败");
					toast("✅ 已上传：" + j.url, 3200);
					renderCfbed();
				}).catch(function (e) { alert("图床上传失败：" + e.message); });
			});
			input.click();
		});
		fetch("/api/imgbed?op=list", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (j) {
			if (!j.ok) { $("#bedList").innerHTML = errBox(j.error || "图床服务不可用"); return; }
			var files = j.files || [];
			$("#bedList").innerHTML = files.length ? files.map(function (f) {
				return '<div class="row"><div class="row-k"><div class="list-t mono">' + esc(f.name || f.path || "?") + '</div></div><div class="row-v">' + (f.size ? '<span class="pill num">' + fmtMB(f.size) + "</span>" : "") + "</div></div>";
			}).join("") : '<div class="empty-block">图床暂无文件（或列举接口未开放）</div>';
		}).catch(function () { $("#bedList").innerHTML = errBox("图床服务不可用（/api/imgbed）"); });
	}

	/* ================= 旧版跳转页 ================= */
	function renderLegacy(key, label, url) {
		setView(key, pageHead('<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
			label, "此页面暂在新控制台之外") +
			'<div class="card"><div class="card-body"><div class="legacy-card"><div>点击右侧按钮打开旧版编辑器（功能完整，界面为旧版风格，后续迭代会迁入新控制台）。</div>' +
			'<a class="btn btn-primary" href="' + url + '">打开旧版编辑器</a></div></div></div>');
	}

	/* ================= 导航 / 路由 ================= */
	var IC = {
		dash: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
		post: '<path d="M4 4h11l5 5v11H4z"/><path d="M15 4v5h5"/><path d="M8.5 13h7M8.5 16.5h4.5"/>',
		diary: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/>',
		friends: '<path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.1 2.1a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
		project: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
		website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
		timeline: '<path d="M3 3v18h18"/><path d="M7 15v-4M12 15V7M17 15v-7"/>',
		anime: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5l5 2.5-5 2.5z"/>',
		devices: '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
		footprints: '<circle cx="6" cy="17" r="2.4"/><circle cx="12" cy="8" r="2.4"/><circle cx="18" cy="15" r="2.4"/>',
		notebooks: '<path d="M5 3h13a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5z"/><path d="M5 3v18M9 7h6M9 11h6"/>',
		about: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
		albums: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M3 17l5-4 4 3 4-4 5 5"/>',
		settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83"/>',
		comments: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.8-.4L3 21l1.5-4.4A8.4 8.4 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4h.6a8.4 8.4 0 0 1 8.4 8.4z"/>',
		stats: '<path d="M3 3v18h18"/><path d="M7 15v-4M12 15V7M17 15v-7"/>',
		release: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4"/>',
		cfbed: '<path d="M17.5 19a4.5 4.5 0 0 0 .42-8.98 6.5 6.5 0 0 0-12.7 1.74A4 4 0 0 0 6 19.5z"/>',
		backup: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
		announcement: '<path d="M3 11l14-6v14L3 13z"/><path d="M17 8a4 4 0 0 1 0 8"/>',
	};
	function icon(key) {
		return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (IC[key] || IC.dash) + "</svg>";
	}
	var NAV = [
		{ group: null, items: [{ id: "dash", label: "仪表盘" }, { id: "posts", label: "文章管理", star: true }] },
		{
			group: "内容数据", items: [
				{ id: "diary", label: "动态管理" }, { id: "friends", label: "友链管理" },
				{ id: "projects", label: "项目管理" }, { id: "about", label: "关于页面" },
			],
		},
		{
			group: "其余数据", items: [
				{ id: "website", label: "网站导航" }, { id: "devices", label: "设备" },
				{ id: "anime", label: "追番" }, { id: "footprints", label: "足迹" },
				{ id: "timeline", label: "时间线" }, { id: "notebooks", label: "笔记本", star: true },
			],
		},
		{ group: null, items: [{ id: "albums", label: "相册管理", legacy: "/admin/albums-edit" }, { id: "announcement", label: "公告", legacy: "/admin/announcement-edit" }] },
		{ group: "站点与外观", items: [{ id: "settings", label: "外观配置" }] },
		{
			group: "系统", items: [
				{ id: "comments", label: "全部评论" }, { id: "release", label: "发布状态" },
				{ id: "cfbed", label: "CF 图床" }, { id: "stats", label: "网站统计" }, { id: "backup", label: "数据备份" },
			],
		},
	];
	var TITLES = {
		dash: "仪表盘", posts: "文章管理", diary: "动态管理", friends: "友链管理", projects: "项目管理",
		website: "网站导航", devices: "设备", anime: "追番", footprints: "足迹", timeline: "时间线",
		notebooks: "笔记本", about: "关于页面", albums: "相册管理", announcement: "公告", settings: "站点与外观",
		comments: "全部评论", stats: "网站统计", release: "发布状态", cfbed: "CF 图床", backup: "数据备份",
	};
	var current = "dash";
	var LOADED = {};
	function renderNav() {
		var root = $("#nav");
		root.innerHTML = "";
		NAV.forEach(function (g) {
			var wrap = el("div", "nav-group");
			if (g.group) {
				var head = el("button", "nav-group-head");
				head.type = "button";
				head.innerHTML = '<span class="nav-label">' + esc(g.group) + '</span><svg class="nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
				head.addEventListener("click", function () { wrap.classList.toggle("open"); });
				wrap.appendChild(head);
				var sub = el("div", "nav-sub");
				g.items.forEach(function (it) { sub.appendChild(navBtn(it)); });
				wrap.appendChild(sub);
			} else {
				g.items.forEach(function (it) { wrap.appendChild(navBtn(it)); });
			}
			root.appendChild(wrap);
		});
	}
	function navBtn(it) {
		var b = el("button", "nav-item");
		b.type = "button";
		b.setAttribute("data-nav", it.id);
		b.innerHTML = icon(it.id) + '<span class="nav-text">' + esc(it.label) + "</span>" + (it.star ? '<span class="nav-star">★</span>' : "");
		b.addEventListener("click", function () {
			go(it.id);
			if (window.matchMedia("(max-width: 1023px)").matches) {
				document.documentElement.removeAttribute("data-drawer");
			}
		});
		return b;
	}
	function syncNav() {
		$$("#nav .nav-item").forEach(function (b) {
			b.classList.toggle("on", b.getAttribute("data-nav") === current);
		});
		var crumb = $("#crumb");
		if (crumb) crumb.innerHTML = "<b>" + esc(TITLES[current] || current) + "</b>";
	}
	function go(id, force) {
		var v = $("#v-" + id);
		if (!v) return;
		if (current === id && !force && v.innerHTML) { return; }
		var sc = window.scrollY;
		current = id;
		$$(".view").forEach(function (x) { x.classList.remove("on"); });
		v.classList.add("on");
		try { history.replaceState(null, "", "#/" + id); } catch (e) { }
		syncNav();
		window.scrollTo(0, 0);
		loadView(id, force);
	}
	function loadView(id, force) {
		var v = $("#v-" + id);
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
		else if (id === "albums") renderLegacy("albums", "相册管理", "/admin/albums-edit");
		else if (id === "announcement") renderLegacy("announcement", "公告", "/admin/announcement-edit");
		else if (window.getSchema(id)) renderDataPage(id);
	}

	/* ================= 登录闸门（预览稿同款 .login 页，替代旧 auth-gate 弹窗） ================= */
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
	/* 兼容 shim：github.js 在 401 时会调 EditorAuthGate.require() */
	window.EditorAuthGate = {
		check: authCheck,
		login: function (pw) { return authLogin(pw); },
		logout: authLogout,
		require: showLogin,
		start: function () { authCheck().then(function (ok) { if (!ok) showLogin(); }); },
	};

	/* ================= 启动 ================= */
	function boot() {
		applyBlogLook();
		renderNav();
		$("#backSite").addEventListener("click", function () { location.href = "/"; });
		$("#collapseBtn").addEventListener("click", function () {
			var r = document.documentElement;
			var collapsed = r.getAttribute("data-side") === "collapsed";
			r.setAttribute("data-side", collapsed ? "expanded" : "collapsed");
			this.querySelector("span").textContent = collapsed ? "收起菜单" : "展开菜单";
			var svg = this.querySelector("svg");
			if (svg) svg.style.transform = collapsed ? "none" : "rotate(180deg)";
		});
		$("#burger").addEventListener("click", function () { document.documentElement.setAttribute("data-drawer", "open"); });
		$("#scrim").addEventListener("click", function () { document.documentElement.removeAttribute("data-drawer"); });
		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape") {
				document.documentElement.removeAttribute("data-drawer");
				openStage(false);
			}
		});
		$("#pushBtn").addEventListener("click", function () { openStage(true); });
		$("#status").addEventListener("click", function () { openStage(true); });
		var spClose = document.querySelector("[data-sp-close]");
		if (spClose) spClose.addEventListener("click", function () { openStage(false); });
		$("#stageMask").addEventListener("click", function () { openStage(false); });
		$("#spPush").addEventListener("click", pushAll);
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
