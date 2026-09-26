/**
 * PaperHero 交互 —— 1:1 移植 flatpaper source/js/main.js 的 initHomeHero 段
 *
 * 移植的完整能力：
 *   · 贴纸随机摆放（4 个区域 + 随机旋转 -18°~+18°）
 *   · 贴纸拖拽（pointer 事件 + setPointerCapture + 3px 阈值 + 边界 clamp）
 *   · shuffle 按钮重新摆放
 *   · 下拉纸签平滑滚动（data-hero-scroll）
 *   · 主题亮暗切换
 *   · 社交书签条超宽自动裁切（syncClippedHeroLinks）
 *   · 外链二次确认气泡（hero-visit-confirm）
 *   · 滚动时切换 body.is-hero-active
 *
 * 与原版差异：原版是 Hexo 全局 main.js 的一部分，这里抽成独立脚本，
 * 并加了幂等（swup 换页后重复执行不会重复绑定）。
 */
(function () {
	"use strict";

	var ROTATE_MIN = -18;
	var ROTATE_SPREAD = 36;
	var DRAG_THRESHOLD = 3;
	var STICKER_ZONES = [
		{ leftMin: 4, leftMax: 19, topMin: 8, topMax: 78 },
		{ leftMin: 78, leftMax: 90, topMin: 8, topMax: 78 },
		{ leftMin: 20, leftMax: 72, topMin: 6, topMax: 20 },
		{ leftMin: 20, leftMax: 72, topMin: 76, topMax: 88 },
	];

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function randomRotate() {
		return ROTATE_MIN + Math.random() * ROTATE_SPREAD;
	}

	function initPaperHero() {
		var hero = document.querySelector("[data-paper-hero]");
		if (!hero || hero.dataset.paperHeroBound === "1") return;
		hero.dataset.paperHeroBound = "1";

		var homeTarget = document.getElementById("paper-home-content");
		var header =
			document.querySelector("#navbar-wrapper") ||
			document.querySelector("#navbar");

		/* ---------------- 外链二次确认气泡 ---------------- */
		var confirmBubble = null;

		function closeVisitConfirm() {
			if (confirmBubble && confirmBubble.parentNode) {
				confirmBubble.parentNode.removeChild(confirmBubble);
			}
			confirmBubble = null;
		}

		function openVisitConfirm(trigger) {
			closeVisitConfirm();
			var href = trigger.getAttribute("href") || "";
			if (!href) return;

			var bubble = document.createElement("div");
			bubble.className = "hero-visit-confirm";
			bubble.setAttribute("role", "dialog");
			bubble.setAttribute("aria-label", "确认访问外部链接");

			var text = document.createElement("p");
			text.textContent = "即将离开本站，前往外部链接";
			bubble.appendChild(text);

			var actions = document.createElement("div");
			actions.className = "hero-visit-confirm__actions";

			var visit = document.createElement("button");
			visit.type = "button";
			visit.className = "hero-visit-confirm__visit";
			visit.textContent = "前往";
			visit.addEventListener("click", function () {
				window.open(href, "_blank", "noopener,noreferrer");
				closeVisitConfirm();
			});

			var cancel = document.createElement("button");
			cancel.type = "button";
			cancel.className = "hero-visit-confirm__cancel";
			cancel.textContent = "取消";
			cancel.addEventListener("click", closeVisitConfirm);

			actions.appendChild(visit);
			actions.appendChild(cancel);
			bubble.appendChild(actions);
			hero.appendChild(bubble);

			var heroRect = hero.getBoundingClientRect();
			var triggerRect = trigger.getBoundingClientRect();
			var bubbleRect = bubble.getBoundingClientRect();
			var left =
				triggerRect.left -
				heroRect.left +
				triggerRect.width / 2 -
				bubbleRect.width / 2;
			var top =
				triggerRect.top -
				heroRect.top -
				bubbleRect.height -
				12;

			left = clamp(left, 12, hero.clientWidth - bubbleRect.width - 12);
			if (top < 12) top = triggerRect.bottom - heroRect.top + 12;
			top = clamp(top, 12, hero.clientHeight - bubbleRect.height - 12);
			bubble.style.left = left + "px";
			bubble.style.top = top + "px";
			visit.focus({ preventScroll: true });
		}

		/* ---------------- 下拉滚动 ---------------- */
		function homeTop() {
			if (!homeTarget) return hero.offsetTop + hero.offsetHeight;
			var headerHeight = header ? header.getBoundingClientRect().height : 0;
			var offset = headerHeight ? headerHeight + 56 : 56;
			return Math.max(
				0,
				homeTarget.getBoundingClientRect().top +
					window.pageYOffset -
					offset,
			);
		}

		function scrollToHome() {
			closeVisitConfirm();
			var top = homeTop();
			var reduce = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
			window.scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
		}

		var scrollLinks = hero.querySelectorAll("[data-hero-scroll]");
		scrollLinks.forEach(function (link) {
			link.addEventListener("click", function (event) {
				var href = link.getAttribute("href") || "";
				if (href.charAt(0) !== "#") return;
				var target = document.getElementById(href.slice(1));
				if (!target) return;
				event.preventDefault();
				scrollToHome();
			});
		});

		/* ---------------- 随机背景图（多图时） ---------------- */
		function applyRandomHeroImage() {
			var rawImages = hero.getAttribute("data-hero-images");
			if (!rawImages) return;
			var images = [];
			try {
				images = JSON.parse(rawImages);
			} catch (e) {
				images = [];
			}
			images = images.filter(function (image) {
				return typeof image === "string" && image;
			});
			if (images.length < 2) return;
			var selected = images[Math.floor(Math.random() * images.length)];
			var next = 'url("' + selected.replace(/"/g, '\\"') + '")';
			if (hero.style.getPropertyValue("--hero-bg-image").trim() === next)
				return;
			hero.style.setProperty("--hero-bg-image", next);
		}
		applyRandomHeroImage();

		/* ---------------- 社交书签条裁切 ---------------- */
		var heroSocialLinks = hero.querySelector(".home-hero__links");
		function syncClippedHeroLinks() {
			if (!heroSocialLinks) return;
			heroSocialLinks.style.setProperty("--hero-links-offset", "0px");
			Array.prototype.forEach.call(
				heroSocialLinks.querySelectorAll("a"),
				function (link) {
					link.style.visibility = "";
					link.style.pointerEvents = "";
					link.removeAttribute("aria-hidden");
					link.removeAttribute("tabindex");
				},
			);
			var containerWidth = heroSocialLinks.clientWidth;
			var visibleRight = 0;
			Array.prototype.forEach.call(
				heroSocialLinks.querySelectorAll("a"),
				function (link) {
					var clipped = link.offsetLeft + link.offsetWidth > containerWidth + 1;
					if (clipped) {
						link.style.visibility = "hidden";
						link.style.pointerEvents = "none";
						link.setAttribute("aria-hidden", "true");
						link.setAttribute("tabindex", "-1");
					} else {
						visibleRight = Math.max(
							visibleRight,
							link.offsetLeft + link.offsetWidth,
						);
					}
				},
			);
			var offset = Math.max(0, Math.floor((containerWidth - visibleRight) / 2));
			heroSocialLinks.style.setProperty("--hero-links-offset", offset + "px");
		}
		window.requestAnimationFrame(syncClippedHeroLinks);
		window.addEventListener(
			"resize",
			function () {
				window.requestAnimationFrame(syncClippedHeroLinks);
			},
			{ passive: true },
		);
		if (window.ResizeObserver && heroSocialLinks) {
			new ResizeObserver(function () {
				window.requestAnimationFrame(syncClippedHeroLinks);
			}).observe(heroSocialLinks);
		}

		/* ---------------- 首屏激活态（供 body::before 淡出） ---------------- */
		var heroScrollTicking = false;
		function setHeroActive() {
			var active =
				window.pageYOffset < hero.offsetTop + hero.offsetHeight - 80;
			document.body.classList.toggle("is-hero-active", active);
		}
		window.addEventListener(
			"scroll",
			function () {
				if (heroScrollTicking) return;
				heroScrollTicking = true;
				window.requestAnimationFrame(function () {
					setHeroActive();
					heroScrollTicking = false;
				});
			},
			{ passive: true },
		);
		setHeroActive();

		/* ---------------- 主题亮暗切换 ---------------- */
		var themeToggle = hero.querySelector(".js-theme-toggle");
		if (themeToggle) {
			themeToggle.addEventListener("click", function () {
				var root = document.documentElement;
				var isDark = root.classList.contains("dark");
				var next = isDark ? "light" : "dark";
				root.classList.toggle("dark", !isDark);
				try {
					localStorage.setItem("theme", next);
				} catch (e) {}
				window.dispatchEvent(
					new CustomEvent("theme-changed", { detail: { theme: next } }),
				);
			});
		}

		/* ---------------- 贴纸：随机摆放 + 拖拽 + shuffle ---------------- */
		var stickers = Array.prototype.slice.call(
			hero.querySelectorAll("[data-hero-sticker]"),
		);
		if (!stickers.length || !hero.classList.contains("has-draggable-stickers"))
			return;

		function randomizeSticker(sticker) {
			var zone = STICKER_ZONES[Math.floor(Math.random() * STICKER_ZONES.length)];
			var left = zone.leftMin + Math.random() * (zone.leftMax - zone.leftMin);
			var top = zone.topMin + Math.random() * (zone.topMax - zone.topMin);
			sticker.style.left = left + "%";
			sticker.style.top = top + "%";
			sticker.style.right = "auto";
			sticker.style.bottom = "auto";
			sticker.style.transform = "rotate(" + randomRotate().toFixed(1) + "deg)";
		}

		stickers.forEach(function (sticker) {
			randomizeSticker(sticker);

			var state = null;

			sticker.addEventListener("click", function (event) {
				if (sticker.dataset.heroDragged === "1") {
					event.preventDefault();
					event.stopPropagation();
					delete sticker.dataset.heroDragged;
				}
			});

			sticker.addEventListener("pointerdown", function (event) {
				if (event.button !== 0 && event.pointerType === "mouse") return;
				var heroRect = hero.getBoundingClientRect();
				var rect = sticker.getBoundingClientRect();
				state = {
					offsetX: event.clientX - rect.left,
					offsetY: event.clientY - rect.top,
					startX: event.clientX,
					startY: event.clientY,
					heroLeft: heroRect.left,
					heroTop: heroRect.top,
					maxX: hero.clientWidth - sticker.offsetWidth,
					maxY: hero.clientHeight - sticker.offsetHeight,
					moved: false,
				};
				sticker.style.transform =
					"rotate(" + randomRotate().toFixed(1) + "deg)";
				sticker.style.left = rect.left - heroRect.left + "px";
				sticker.style.top = rect.top - heroRect.top + "px";
				sticker.style.right = "auto";
				sticker.style.bottom = "auto";
				sticker.style.zIndex = "6";
				sticker.classList.add("is-dragging");
				if (sticker.setPointerCapture)
					sticker.setPointerCapture(event.pointerId);
			});

			sticker.addEventListener("pointermove", function (event) {
				if (!state) return;
				if (
					Math.abs(event.clientX - state.startX) > DRAG_THRESHOLD ||
					Math.abs(event.clientY - state.startY) > DRAG_THRESHOLD
				) {
					state.moved = true;
				}
				var x = clamp(
					event.clientX - state.heroLeft - state.offsetX,
					0,
					state.maxX,
				);
				var y = clamp(
					event.clientY - state.heroTop - state.offsetY,
					0,
					state.maxY,
				);
				sticker.style.left = x + "px";
				sticker.style.top = y + "px";
				if (state.moved) event.preventDefault();
			});

			function endDrag(event, cancelled) {
				if (!state) return;
				var moved = state.moved;
				state = null;
				sticker.style.zIndex = "";
				sticker.classList.remove("is-dragging");
				if (moved && !cancelled) {
					sticker.dataset.heroDragged = "1";
					window.setTimeout(function () {
						delete sticker.dataset.heroDragged;
					}, 400);
				}
				if (sticker.releasePointerCapture && event && event.pointerId != null) {
					try {
						sticker.releasePointerCapture(event.pointerId);
					} catch (e) {}
				}
			}

			sticker.addEventListener("pointerup", function (event) {
				endDrag(event, false);
			});
			sticker.addEventListener("pointercancel", function (event) {
				endDrag(event, true);
			});
		});

		var shuffleButton = hero.querySelector(".js-hero-shuffle");
		if (shuffleButton) {
			shuffleButton.addEventListener("click", function () {
				closeVisitConfirm();
				stickers.forEach(function (sticker) {
					delete sticker.dataset.heroDragged;
					sticker.style.zIndex = "";
					sticker.classList.remove("is-dragging");
					randomizeSticker(sticker);
				});
			});
		}

		document.addEventListener("click", function (event) {
			if (!confirmBubble) return;
			if (confirmBubble.contains(event.target)) return;
			closeVisitConfirm();
		});
		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape") closeVisitConfirm();
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initPaperHero);
	} else {
		initPaperHero();
	}

	// swup 无刷新换页后重新初始化
	document.addEventListener("page:view", initPaperHero);
	document.addEventListener("content:replace", initPaperHero);
	document.addEventListener("swup:page:view", initPaperHero);
})();
