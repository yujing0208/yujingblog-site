/**
 * yujingblog 页面内编辑器 · 全局入口 v2
 * 入口：设置面板底部的「进入编辑页面」按钮 / window.EditorLogin.start()（看板娘菜单等）
 *
 * v2（密码登录版）流程：
 *   点入口 → GET /api/editor-auth 查会话
 *     ├ 已登录 → 直接开 /admin/xxx-edit
 *     └ 未登录 → 弹「输入编辑密码」→ POST /api/editor-auth
 *                → 服务端下发 HttpOnly 签名 Cookie（30 天）→ 开 /admin/xxx-edit
 *
 * 浏览器不再保存 GitHub Token，URL 里也不再带 token（旧的 #pat= 机制已废弃）。
 */
(function () {
	"use strict";

	var FROM_KEY = "yuj_editor_from";
	var AUTH_URL = "/api/editor-auth";
	var EDIT_PAGES = [
		"projects", "friends", "websites", "about", "timeline", "diary",
		"devices", "anime", "announcement", "footprints", "albums", "post",
	];
	var EDIT_LABELS = {
		projects: "项目", friends: "友链", websites: "网站导航", about: "关于我",
		timeline: "时间线", diary: "日记", devices: "设备", anime: "追番",
		announcement: "公告", footprints: "足迹", albums: "相册", post: "文章",
	};

	function getFrom() { try { return sessionStorage.getItem(FROM_KEY) || "/"; } catch (e) { return "/"; } }
	function setFrom(u) { try { sessionStorage.setItem(FROM_KEY, u); } catch (e) { } }

	/** 查询登录状态 → Promise<boolean> */
	function checkAuth() {
		return fetch(AUTH_URL, {
			method: "GET",
			credentials: "same-origin",
			cache: "no-store",
		}).then(function (r) {
			if (!r.ok) return false;
			return r.json().then(function (j) { return !!(j && j.ok); });
		}).catch(function () { return false; });
	}

	/** 提交密码 → Promise<{ok, error?}> */
	function login(password) {
		return fetch(AUTH_URL, {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: password }),
		}).then(function (r) {
			return r.json().catch(function () { return {}; }).then(function (j) {
				if (!r.ok || !j || !j.ok) {
					return { ok: false, error: (j && j.error) || "密码错误" };
				}
				return { ok: true, login: j.login || "" };
			});
		}).catch(function () {
			return { ok: false, error: "网络异常，请稍后重试" };
		});
	}

	/** 退出登录（清除服务端 Cookie） */
	function logout() {
		return fetch(AUTH_URL, { method: "DELETE", credentials: "same-origin" }).catch(function () { });
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
			".yuj-editor-btn-primary{background:var(--primary,#4c6ef5);border-color:var(--primary,#4c6ef5);color:#fff}" +
			".yuj-editor-btn-primary:hover{filter:brightness(.92)}" +
			".yuj-editor-btn-block{width:100%;margin-bottom:8px}" +
			".yuj-pick-list{display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow-y:auto;margin-top:8px}" +
			".yuj-pick{text-align:left}" +
			".yuj-editor-modal .yuj-editor-btn-block{box-sizing:border-box}";
		document.head.appendChild(s);
	}

	/** 密码弹窗 → resolve(true) 已登录 / resolve(false) 取消 */
	function showPasswordModal() {
		return new Promise(function (resolve) {
			var ov = overlay();
			ov.innerHTML =
				'<div class="yuj-editor-modal" role="dialog" aria-label="编辑登录">' +
				'<h3>进入编辑模式</h3>' +
				'<p class="yuj-editor-desc">输入编辑密码即可进入。登录状态保持 30 天，期间无需重复输入。</p>' +
				'<input type="password" class="yuj-editor-input" placeholder="编辑密码" autocomplete="current-password" spellcheck="false">' +
				'<p class="yuj-editor-err" style="display:none;color:#e5484d"></p>' +
				'<div class="yuj-editor-actions">' +
				'<button class="yuj-editor-btn" data-act="cancel">取消</button>' +
				'<button class="yuj-editor-btn yuj-editor-btn-primary" data-act="ok">进入</button>' +
				'</div>' +
				'<p class="yuj-editor-hint">密码由站点环境变量 EDITOR_PASSWORD 设置，不保存在浏览器里。</p>' +
				'</div>';
			var input = ov.querySelector(".yuj-editor-input");
			var errEl = ov.querySelector(".yuj-editor-err");
			var okBtn = ov.querySelector('[data-act="ok"]');
			var cancelBtn = ov.querySelector('[data-act="cancel"]');
			var busy = false;

			function doOk() {
				if (busy) return;
				var pwd = input.value;
				if (!pwd) { errEl.textContent = "请输入密码"; errEl.style.display = "block"; return; }
				busy = true;
				okBtn.disabled = true;
				okBtn.textContent = "验证中…";
				login(pwd).then(function (res) {
					busy = false;
					okBtn.disabled = false;
					okBtn.textContent = "进入";
					if (res.ok) {
						document.body.removeChild(ov);
						resolve(true);
					} else {
						errEl.textContent = res.error || "密码错误";
						errEl.style.display = "block";
						input.select();
					}
				});
			}

			okBtn.addEventListener("click", doOk);
			cancelBtn.addEventListener("click", function () { document.body.removeChild(ov); resolve(false); });
			input.addEventListener("keydown", function (e) { if (e.key === "Enter") doOk(); });
			ov.addEventListener("click", function (e) { if (e.target === ov) { document.body.removeChild(ov); resolve(false); } });
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

	function openEditor(edit) {
		setFrom(location.href);
		window.open("/admin/" + edit + "-edit", "_blank", "noopener");
	}

	/** 已登录直接开；未登录先弹密码，成功后开 */
	function doEnter(edit) {
		checkAuth().then(function (ok) {
			if (ok) { openEditor(edit); return; }
			showPasswordModal().then(function (done) {
				if (done) openEditor(edit);
			});
		});
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
		// 兼容旧调用名：以前是 verify(pat)，现在是查询登录态
		verify: checkAuth,
		check: checkAuth,
		login: login,
		logout: logout,
	};

	// 入口一（导航栏 logo）已移除：点击 logo 直接走默认 <a href="/"> 回首页。
	// 编辑入口仅保留：① 设置面板底部的「进入编辑页面」按钮 ② window.EditorLogin.start() 供其他调用。

	function init() {
		injectStyles();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
