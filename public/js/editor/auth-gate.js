/**
 * auth-gate：/admin/*-edit 编辑页的登录闸门
 *
 * 编辑页是静态页（prerender），所以这里做两件事：
 * 1. 打开页面先挡住内容，查询 /api/editor-auth；
 * 2. 未登录就弹「输入编辑密码」，通过后 location.reload() 正常进编辑器。
 *
 * 注意：真正的安全边界在服务端 —— 就算有人绕过这个闸门看到编辑界面，
 * /api/editor-github 依然会因为缺少签名 Cookie 而返回 401，无法读写任何文件。
 */
(function () {
	"use strict";

	var AUTH_URL = "/api/editor-auth";
	var STYLE_ID = "yuj-auth-gate-style";

	function injectStyles() {
		if (document.getElementById(STYLE_ID)) return;
		var s = document.createElement("style");
		s.id = STYLE_ID;
		s.textContent =
			"html.yuj-locked #editor-root,html.yuj-locked #ed-pages{visibility:hidden}" +
			".yuj-gate-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:2147483000;padding:20px;font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif}" +
			".yuj-gate-modal{background:#161a21;border:1px solid #2c323d;border-radius:14px;padding:24px;width:100%;max-width:420px;color:#e6e6e6}" +
			".yuj-gate-modal h3{margin:0 0 8px;font-size:17px}" +
			".yuj-gate-desc{color:#8b93a3;font-size:13px;line-height:1.6;margin:0 0 14px}" +
			".yuj-gate-input{width:100%;background:#0f1115;border:1px solid #2c323d;color:#e6e6e6;border-radius:8px;padding:10px;font-size:14px;box-sizing:border-box}" +
			".yuj-gate-err{margin:8px 0 0;font-size:13px;color:#e5484d;display:none}" +
			".yuj-gate-actions{display:flex;gap:10px;margin-top:16px;justify-content:flex-end}" +
			".yuj-gate-btn{background:#222936;border:1px solid #333c4d;color:#dde2ea;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px}" +
			".yuj-gate-btn:hover{background:#2a3342}" +
			".yuj-gate-btn-primary{background:var(--primary,#4c6ef5);border-color:var(--primary,#4c6ef5);color:#fff}" +
			".yuj-gate-btn-primary:hover{filter:brightness(.92)}" +
			".yuj-gate-btn:disabled{opacity:.6;cursor:default}";
		document.head.appendChild(s);
	}

	function lock() { document.documentElement.classList.add("yuj-locked"); }
	function unlock() { document.documentElement.classList.remove("yuj-locked"); }

	function checkAuth() {
		return fetch(AUTH_URL, { method: "GET", credentials: "same-origin", cache: "no-store" })
			.then(function (r) { return r.ok ? r.json() : { ok: false }; })
			.then(function (j) { return !!(j && j.ok); })
			.catch(function () { return false; });
	}

	function login(password) {
		return fetch(AUTH_URL, {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: password }),
		}).then(function (r) {
			return r.json().catch(function () { return {}; }).then(function (j) {
				if (!r.ok || !j || !j.ok) return { ok: false, error: (j && j.error) || "密码错误" };
				return { ok: true };
			});
		}).catch(function () { return { ok: false, error: "网络异常，请稍后重试" }; });
	}

	function logout() {
		return fetch(AUTH_URL, { method: "DELETE", credentials: "same-origin" }).catch(function () { });
	}

	var gateEl = null;

	function showGate() {
		injectStyles();
		lock();
		if (gateEl) return;

		gateEl = document.createElement("div");
		gateEl.className = "yuj-gate-overlay";
		gateEl.innerHTML =
			'<div class="yuj-gate-modal" role="dialog" aria-label="编辑登录">' +
			'<h3>需要登录</h3>' +
			'<p class="yuj-gate-desc">编辑会话已过期或尚未登录。输入编辑密码继续，登录后 30 天内无需重复输入。</p>' +
			'<input type="password" class="yuj-gate-input" placeholder="编辑密码" autocomplete="current-password" spellcheck="false">' +
			'<p class="yuj-gate-err"></p>' +
			'<div class="yuj-gate-actions">' +
			'<button class="yuj-gate-btn yuj-gate-btn-primary" data-act="ok">登录</button>' +
			'</div>' +
			'</div>';

		var input = gateEl.querySelector(".yuj-gate-input");
		var errEl = gateEl.querySelector(".yuj-gate-err");
		var okBtn = gateEl.querySelector('[data-act="ok"]');
		var busy = false;

		function submit() {
			if (busy) return;
			var pwd = input.value;
			if (!pwd) { errEl.textContent = "请输入密码"; errEl.style.display = "block"; return; }
			busy = true;
			okBtn.disabled = true;
			okBtn.textContent = "验证中…";
			login(pwd).then(function (res) {
				if (res.ok) {
					location.reload();
					return;
				}
				busy = false;
				okBtn.disabled = false;
				okBtn.textContent = "登录";
				errEl.textContent = res.error || "密码错误";
				errEl.style.display = "block";
				input.select();
			});
		}

		okBtn.addEventListener("click", submit);
		input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });

		document.body.appendChild(gateEl);
		setTimeout(function () { input.focus(); }, 60);
	}

	function start() {
		injectStyles();
		lock();
		checkAuth().then(function (ok) {
			if (ok) { unlock(); return; }
			showGate();
		});
	}

	window.EditorAuthGate = {
		check: checkAuth,
		login: login,
		logout: logout,
		require: showGate,
		start: start,
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start);
	} else {
		start();
	}
})();
