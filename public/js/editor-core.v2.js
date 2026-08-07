/**
 * yujingblog 页面内编辑器 · 全局入口 v2
 * 入口一：导航栏 logo 点击（capture 阶段，抢在 Swup 前）
 * 入口二：看板娘菜单「编辑」项（EditorLogin.start()）
 * 流程：弹 PAT 输入 → 验证（GET /user）→ 存 sessionStorage → 跳 /admin/xxx-edit
 */
(function () {
	"use strict";

	var PAT_KEY = "yuj_editor_pat";
	var FROM_KEY = "yuj_editor_from";
	var EDIT_PAGES = [
		"projects", "friends", "websites", "about", "timeline", "diary",
		"devices", "anime", "announcement", "footprints", "albums", "post",
	];
	var EDIT_LABELS = {
		projects: "项目", friends: "友链", websites: "网站导航", about: "关于我",
		timeline: "时间线", diary: "日记", devices: "设备", anime: "追番",
		announcement: "公告", footprints: "足迹", albums: "相册", post: "文章",
	};

	function getPat() { try { return sessionStorage.getItem(PAT_KEY) || ""; } catch (e) { return ""; } }
	function setPat(p) { try { sessionStorage.setItem(PAT_KEY, p); } catch (e) { } }
	function getFrom() { try { return sessionStorage.getItem(FROM_KEY) || "/"; } catch (e) { return "/"; } }
	function setFrom(u) { try { sessionStorage.setItem(FROM_KEY, u); } catch (e) { } }

	function verifyToken(pat) {
		return fetch("https://api.github.com/user", {
			headers: {
				"Authorization": "Bearer " + pat,
				"Accept": "application/vnd.github+json",
				"User-Agent": "yujing-blog-editor",
			},
		}).then(function (r) {
			if (!r.ok) return null;
			return r.json().then(function (u) { return u.login || null; });
		}).catch(function () { return null; });
	}

	function overlay() {
		var ov = document.createElement("div");
		ov.className = "yuj-editor-overlay";
		return ov;
	}

	// 弹窗样式内联注入（站点页面不加载 /js/editor/style.css）
	function injectStyles() {
		if (document.getElementById("yuj-editor-style")) return;
		var s = document.createElement("style");
		s.id = "yuj-editor-style";
		s.textContent =
			".yuj-editor-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:999999;padding:20px}" +
			".yuj-editor-modal{background:#161a21;border:1px solid #2c323d;border-radius:14px;padding:24px;width:100%;max-width:440px;font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#e6e6e6}" +
			".yuj-editor-modal h3{margin:0 0 8px;font-size:17px}" +
			".yuj-editor-desc{color:#8b93a3;font-size:13px;line-height:1.6;margin:0 0 14px}" +
			".yuj-editor-desc code{background:#0f1115;padding:2px 6px;border-radius:4px}" +
			".yuj-editor-input{width:100%;background:#0f1115;border:1px solid #2c323d;color:#e6e6e6;border-radius:8px;padding:10px;font-size:14px;box-sizing:border-box}" +
			".yuj-editor-err{margin:8px 0 0;font-size:13px}" +
			".yuj-editor-actions{display:flex;gap:10px;margin-top:16px;justify-content:flex-end}" +
			".yuj-editor-hint{font-size:12px;color:#6b7486;margin-top:12px}" +
			".yuj-editor-hint a{color:#4c6ef5}" +
			".yuj-editor-btn{background:#222936;border:1px solid #333c4d;color:#dde2ea;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px}" +
			".yuj-editor-btn:hover{background:#2a3342}" +
			".yuj-editor-btn-primary{background:#4c6ef5;border-color:#4c6ef5;color:#fff}" +
			".yuj-editor-btn-primary:hover{background:#3b5bdb}" +
			".yuj-editor-btn-block{width:100%;margin-bottom:8px}" +
			".yuj-pick-list{display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow-y:auto;margin-top:8px}" +
			".yuj-pick{text-align:left}" +
			".yuj-editor-modal .yuj-editor-btn-block{box-sizing:border-box}";
		document.head.appendChild(s);
	}

	function showPatModal() {
		return new Promise(function (resolve) {
			var ov = overlay();
			ov.innerHTML =
				'<div class="yuj-editor-modal" role="dialog" aria-label="编辑登录">' +
				'<h3>进入编辑模式</h3>' +
				'<p class="yuj-editor-desc">输入 GitHub Personal Access Token（需 <code>repo</code> 权限）。<br>Token 仅保存在本浏览器会话中，关闭页面即清除。</p>' +
				'<input type="password" class="yuj-editor-input" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" autocomplete="off" spellcheck="false">' +
				'<p class="yuj-editor-err" style="display:none;color:#e5484d"></p>' +
				'<div class="yuj-editor-actions">' +
				'<button class="yuj-editor-btn" data-act="cancel">取消</button>' +
				'<button class="yuj-editor-btn yuj-editor-btn-primary" data-act="ok">验证并进入</button>' +
				'</div>' +
				'<p class="yuj-editor-hint">还没有 Token？<a href="https://github.com/settings/tokens" target="_blank" rel="noopener">去 GitHub 生成</a></p>' +
				'</div>';
			var input = ov.querySelector(".yuj-editor-input");
			var errEl = ov.querySelector(".yuj-editor-err");
			var okBtn = ov.querySelector('[data-act="ok"]');
			var cancelBtn = ov.querySelector('[data-act="cancel"]');
			var busy = false;

			function doOk() {
				if (busy) return;
				var pat = input.value.trim();
				if (!pat) { errEl.textContent = "请输入 Token"; errEl.style.display = "block"; return; }
				busy = true;
				okBtn.disabled = true;
				okBtn.textContent = "验证中…";
				verifyToken(pat).then(function (login) {
					busy = false;
					okBtn.disabled = false;
					okBtn.textContent = "验证并进入";
					if (login) {
						document.body.removeChild(ov);
						resolve(pat);
					} else {
						errEl.textContent = "Token 无效或无权限，请检查后重试";
						errEl.style.display = "block";
					}
				});
			}
			okBtn.addEventListener("click", doOk);
			cancelBtn.addEventListener("click", function () { document.body.removeChild(ov); resolve(null); });
			input.addEventListener("keydown", function (e) { if (e.key === "Enter") doOk(); });
			ov.addEventListener("click", function (e) { if (e.target === ov) { document.body.removeChild(ov); resolve(null); } });
			document.body.appendChild(ov);
			setTimeout(function () { input.focus(); }, 50);
		});
	}

	function showPagePicker() {
		return new Promise(function (resolve) {
			var ov = overlay();
			var rows = EDIT_PAGES.map(function (p) {
				return '<button class="yuj-editor-btn yuj-editor-btn-block yuj-pick" data-page="' + p + '">' +
					EDIT_LABELS[p] + " · " + p + "</button>";
			}).join("");
			ov.innerHTML =
				'<div class="yuj-editor-modal">' +
				'<h3>选择要编辑的页面</h3>' +
				'<div class="yuj-pick-list">' + rows + "</div>" +
				'<div class="yuj-editor-actions"><button class="yuj-editor-btn" data-act="cancel">取消</button></div>' +
				"</div>";
			ov.querySelectorAll(".yuj-pick").forEach(function (b) {
				b.addEventListener("click", function () {
					var page = b.getAttribute("data-page");
					document.body.removeChild(ov);
					resolve(page);
				});
			});
			ov.querySelector('[data-act="cancel"]').addEventListener("click", function () {
				document.body.removeChild(ov);
				resolve(null);
			});
			ov.addEventListener("click", function (e) { if (e.target === ov) { document.body.removeChild(ov); resolve(null); } });
			document.body.appendChild(ov);
		});
	}

	function doEnter(edit) {
		var pat = getPat();
		if (!pat) {
			showPatModal().then(function (p) {
				if (!p) return;
				setPat(p);
				setFrom(location.href);
				location.href = "/admin/" + edit + "-edit";
			});
		} else {
			setFrom(location.href);
			location.href = "/admin/" + edit + "-edit";
		}
	}

	/** 全局入口：看板娘菜单等调用。无参时优先当前页 data-edit，否则弹页面选择器 */
	window.EditorLogin = {
		start: function (edit) {
			var target = edit || document.body.getAttribute("data-edit");
			if (!target || EDIT_PAGES.indexOf(target) === -1) {
				showPagePicker().then(function (page) {
					if (!page) return;
					doEnter(page);
				});
				return;
			}
			doEnter(target);
		},
		verify: verifyToken,
	};

	// ---------- 入口一：logo 点击（capture 阶段抢在 Swup 前） ----------
	// 只用 #site-logo（Navbar.astro 中 logo 的唯一 id），避免误伤导航栏
	// 其他带 btn-plain class 的一级菜单链接（首页/归档等）
	function onLogoClick(e) {
		var t = e.target;
		var logo = t && t.closest && t.closest("#site-logo");
		if (!logo) return;
		var edit = document.body.getAttribute("data-edit");
		if (!edit || EDIT_PAGES.indexOf(edit) === -1) return; // 非编辑页：正常导航
		e.preventDefault();
		e.stopPropagation();
		if (e.stopImmediatePropagation) e.stopImmediatePropagation();
		doEnter(edit);
	}

	function init() {
		injectStyles();
		document.addEventListener("click", onLogoClick, true);
		document.addEventListener("click", onLogoClick, false);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
