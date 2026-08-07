/**
 * yujingblog 页面内编辑器 · 全局入口
 * 挂在所有页面（Layout.astro 注入）：监听导航栏 logo 点击 → PAT 验证 → 跳转 /admin/xxx-edit
 * 原页面渲染零改动，仅附加交互。
 */
(function () {
	"use strict";

	var PAT_KEY = "yuj_editor_pat";
	var FROM_KEY = "yuj_editor_from";
	var EDIT_PAGES = [
		"projects", "friends", "websites", "about", "timeline", "diary",
		"devices", "anime", "announcement", "footprints", "albums", "post",
	];

	function getPat() { try { return sessionStorage.getItem(PAT_KEY) || ""; } catch (e) { return ""; } }
	function setPat(p) { try { sessionStorage.setItem(PAT_KEY, p); } catch (e) { } }
	function clearPat() { try { sessionStorage.removeItem(PAT_KEY); } catch (e) { } }
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

	function showPatModal() {
		return new Promise(function (resolve) {
			var ov = document.createElement("div");
			ov.className = "yuj-editor-overlay";
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

	function bindLogo() {
		var logo = document.querySelector("#navbar a.btn-plain");
		if (!logo) return;
		logo.addEventListener("click", function (e) {
			var edit = document.body.getAttribute("data-edit");
			if (!edit || EDIT_PAGES.indexOf(edit) === -1) return; // 非编辑页：正常导航
			e.preventDefault();
			e.stopPropagation();
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
		});
	}

	// Swup 页面切换后导航栏 DOM 不变（SPA），但保险起见监听一下
	function init() {
		bindLogo();
		document.addEventListener("swup:contentReplaced", bindLogo);
	}
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
