/**
 * PaperHeader 交互 —— 1:1 移植 flatpaper source/js/main.js 的导航相关段
 *
 * 移植的完整行为（对应 main.js 第 75-224、1430-1480 行）：
 *   · 主题亮暗切换 .theme-toggle → 切 root 的 dark 类 + 持久化
 *   · 主菜单下拉 .site-nav-item.has-children / .site-nav-parent
 *       → 点击开合、同时只开一个、点外部关闭、aria-expanded 同步
 *   · 抽屉菜单分组 .drawer-nav-parent → 开合
 *   · 搜索弹窗 .js-search-open → 打开搜索
 *   · 侧栏抽屉 .js-sidebar-toggle → 开合侧栏 + aria-expanded
 *   · logo 菜单 .brand-mark-wrapper → 开合
 *   · 配色选择器 .accent-picker/.accent-toggle/.accent-option → 开合 + 选中
 *
 * 幂等：所有绑定都用 dataset 标记，swup 换页后重复执行不会重复绑定。
 */
(function () {
	"use strict";

	var ROOT = document.documentElement;

	function safeSet(key, value) {
		try { localStorage.setItem(key, value); } catch (e) {}
	}

	/* ---------------- 主题亮暗切换 ---------------- */
	function initThemeToggle() {
		document.querySelectorAll(".theme-toggle").forEach(function (toggle) {
			if (toggle.dataset.paperBound) return;
			toggle.dataset.paperBound = "1";
			toggle.addEventListener("click", function () {
				var isDark = ROOT.classList.contains("dark");
				ROOT.classList.toggle("dark", !isDark);
				safeSet("theme", isDark ? "light" : "dark");
				window.dispatchEvent(
					new CustomEvent("theme-changed", {
						detail: { theme: isDark ? "light" : "dark" },
					}),
				);
			});
		});
	}

	/* ---------------- 配色选择器（7 色，照搬 flatpaper accants） ---------------- */
	var ACCENTS = ["orange", "purple", "sakura", "blue", "pink", "green", "black"];

	function applyAccent(value) {
		if (ACCENTS.indexOf(value) === -1) value = "green";
		ROOT.setAttribute("data-accent", value);
		document.querySelectorAll("[data-accent-option]").forEach(function (option) {
			var on = option.dataset.accentOption === value;
			option.setAttribute("aria-checked", on ? "true" : "false");
			option.setAttribute("aria-pressed", on ? "true" : "false");
		});
	}

	function closeAccentMenu(picker) {
		if (!picker) return;
		var toggle = picker.querySelector(".accent-toggle");
		picker.classList.remove("is-open");
		if (toggle) toggle.setAttribute("aria-expanded", "false");
	}

	function closeOtherAccentMenus(except) {
		document.querySelectorAll(".accent-picker.is-open").forEach(function (picker) {
			if (picker !== except) closeAccentMenu(picker);
		});
	}

	function openAccentMenu(picker) {
		var toggle = picker.querySelector(".accent-toggle");
		closeOtherAccentMenus(picker);
		picker.classList.add("is-open");
		if (toggle) toggle.setAttribute("aria-expanded", "true");
	}

	function initAccentPicker() {
		var stored = ROOT.getAttribute("data-accent");
		applyAccent(stored || "green");

		document.querySelectorAll(".accent-picker").forEach(function (picker) {
			var toggle = picker.querySelector(".accent-toggle");
			var menu = picker.querySelector(".accent-menu");
			if (!toggle || !menu || toggle.dataset.paperBound) return;
			toggle.dataset.paperBound = "1";

			toggle.addEventListener("click", function (event) {
				event.stopPropagation();
				if (picker.classList.contains("is-open")) closeAccentMenu(picker);
				else openAccentMenu(picker);
			});

			menu.querySelectorAll("[data-accent-option]").forEach(function (option) {
				option.addEventListener("click", function () {
					var next = option.dataset.accentOption;
					applyAccent(next);
					safeSet("paper-accent", next);
					closeAccentMenu(picker);
				});
			});
		});

		// 点外部关闭
		if (!document.documentElement.dataset.paperAccentOutside) {
			document.documentElement.dataset.paperAccentOutside = "1";
			document.addEventListener("click", function (event) {
				if (event.target.closest && event.target.closest(".accent-picker")) return;
				document.querySelectorAll(".accent-picker.is-open").forEach(closeAccentMenu);
			});
		}
	}

	/* ---------------- 主菜单下拉 ---------------- */
	function closeAllNavMenus() {
		document.querySelectorAll(".site-nav-item.has-children.is-open").forEach(function (item) {
			item.classList.remove("is-open");
			var btn = item.querySelector(".site-nav-parent");
			if (btn) btn.setAttribute("aria-expanded", "false");
		});
	}

	function initNavDropdowns() {
		document.querySelectorAll(".site-nav-item.has-children").forEach(function (item) {
			var btn = item.querySelector(".site-nav-parent");
			if (!btn || btn.dataset.paperBound) return;
			btn.dataset.paperBound = "1";
			btn.addEventListener("click", function (event) {
				event.stopPropagation();
				var willOpen = !item.classList.contains("is-open");
				closeAllNavMenus();
				item.classList.toggle("is-open", willOpen);
				btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
			});
		});

		if (!document.documentElement.dataset.paperNavOutside) {
			document.documentElement.dataset.paperNavOutside = "1";
			document.addEventListener("click", function (event) {
				if (event.target.closest && event.target.closest(".site-nav-item.has-children")) return;
				closeAllNavMenus();
			});
		}
	}

	/* ---------------- 抽屉菜单分组 ---------------- */
	function initDrawerNav() {
		document.querySelectorAll(".drawer-nav-parent").forEach(function (btn) {
			if (btn.dataset.paperBound) return;
			btn.dataset.paperBound = "1";
			btn.addEventListener("click", function () {
				var group = btn.closest(".drawer-nav-group");
				if (!group) return;
				var willOpen = !group.classList.contains("is-open");
				group.classList.toggle("is-open", willOpen);
				btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
			});
		});
	}

	/* ---------------- 侧栏抽屉开关 ---------------- */
	function initSidebarToggles() {
		document.querySelectorAll(".js-sidebar-toggle").forEach(function (btn) {
			if (btn.dataset.paperBound) return;
			btn.dataset.paperBound = "1";
			btn.addEventListener("click", function () {
				var drawer = document.getElementById("paper-sidebar-drawer");
				var backdrop = document.querySelector(".sidebar-backdrop");
				if (!drawer) return;
				var willOpen = !drawer.classList.contains("is-open");
				drawer.classList.toggle("is-open", willOpen);
				if (backdrop) backdrop.classList.toggle("is-open", willOpen);
				document.body.classList.toggle("sidebar-open", willOpen);
				btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
			});
		});

		document.querySelectorAll(".js-sidebar-close, .sidebar-backdrop").forEach(function (el) {
			if (el.dataset.paperBound) return;
			el.dataset.paperBound = "1";
			el.addEventListener("click", function () {
				var drawer = document.getElementById("paper-sidebar-drawer");
				var backdrop = document.querySelector(".sidebar-backdrop");
				if (drawer) drawer.classList.remove("is-open");
				if (backdrop) backdrop.classList.remove("is-open");
				document.body.classList.remove("sidebar-open");
				document.querySelectorAll(".js-sidebar-toggle").forEach(function (b) {
					b.setAttribute("aria-expanded", "false");
				});
			});
		});
	}

	/* ---------------- logo 菜单 ---------------- */
	function initBrandMenu() {
		document.querySelectorAll(".brand-mark-wrapper").forEach(function (wrapper) {
			var mark = wrapper.querySelector(".brand-mark");
			if (!mark || mark.dataset.paperBound) return;
			mark.dataset.paperBound = "1";
			mark.addEventListener("click", function (event) {
				event.stopPropagation();
				var willOpen = !wrapper.classList.contains("is-open");
				wrapper.classList.toggle("is-open", willOpen);
				mark.setAttribute("aria-expanded", willOpen ? "true" : "false");
			});
		});

		if (!document.documentElement.dataset.paperBrandOutside) {
			document.documentElement.dataset.paperBrandOutside = "1";
			document.addEventListener("click", function (event) {
				if (event.target.closest && event.target.closest(".brand-mark-wrapper")) return;
				document.querySelectorAll(".brand-mark-wrapper.is-open").forEach(function (w) {
					w.classList.remove("is-open");
					var m = w.querySelector(".brand-mark");
					if (m) m.setAttribute("aria-expanded", "false");
				});
			});
		}
	}

	/* ---------------- 搜索入口 ---------------- */
	function initSearchOpen() {
		document.querySelectorAll(".js-search-open").forEach(function (btn) {
			if (btn.dataset.paperBound) return;
			btn.dataset.paperBound = "1";
			btn.addEventListener("click", function () {
				// 本站搜索由 Search 组件负责，这里只做兼容转发
				var trigger =
					document.getElementById("search-container") ||
					document.getElementById("search-bar");
				if (trigger) {
					var inner = trigger.querySelector("button, [role='button']");
					if (inner) inner.click();
				}
			});
		});
	}

	/* ---------------- 键盘可达性（照搬原版的 Esc 关闭） ---------------- */
	function initEscape() {
		if (document.documentElement.dataset.paperEsc) return;
		document.documentElement.dataset.paperEsc = "1";
		document.addEventListener("keydown", function (event) {
			if (event.key !== "Escape") return;
			closeAllNavMenus();
			document.querySelectorAll(".accent-picker.is-open").forEach(closeAccentMenu);
			document.querySelectorAll(".brand-mark-wrapper.is-open").forEach(function (w) {
				w.classList.remove("is-open");
			});
		});
	}

	function initAll() {
		initThemeToggle();
		initAccentPicker();
		initNavDropdowns();
		initDrawerNav();
		initSidebarToggles();
		initBrandMenu();
		initSearchOpen();
		initEscape();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initAll);
	} else {
		initAll();
	}

	document.addEventListener("page:view", initAll);
	document.addEventListener("content:replace", initAll);
	document.addEventListener("swup:page:view", initAll);
})();
