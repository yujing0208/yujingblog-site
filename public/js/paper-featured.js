/**
 * PaperFeaturedCarousel 交互 —— 1:1 移植 flatpaper source/js/main.js
 * 的 "Featured carousel" 段（第 1933-1980 行）
 *
 * 移植的完整行为：
 *   · show(index) 取模循环，切 is-active（标题/圆点同步）
 *   · 箭头 prev/next，点击后重启 autoplay
 *   · 圆点直达某一屏，点击后重启 autoplay
 *   · autoplay 间隔来自 data-autoplay（0 = 不自动）
 *   · mouseenter/focusin 暂停，mouseleave/focusout 恢复
 *   · 键盘 ArrowLeft / ArrowRight 切换
 *
 * 幂等：重复执行不会重复绑定（dataset 标记）。
 * 2026-10-06：站点已改回浏览器原生整页刷新（对齐 flatpaper 参考站），
 *            每次跳转脚本都会重新执行，幂等标记用于 bfcache 恢复等场景。
 */
(function () {
	"use strict";

	function initPaperFeatured() {
		document.querySelectorAll(".featured-carousel").forEach(function (carousel) {
			if (carousel.dataset.paperFeaturedBound === "1") return;
			carousel.dataset.paperFeaturedBound = "1";

			var slides = Array.prototype.slice.call(
				carousel.querySelectorAll(".featured-paper"),
			);
			if (slides.length < 2) return;

			var dots = Array.prototype.slice.call(
				carousel.querySelectorAll(".carousel-dot"),
			);
			var prevBtn = carousel.querySelector(".carousel-prev");
			var nextBtn = carousel.querySelector(".carousel-next");
			var current = 0;
			var autoplay = parseInt(carousel.getAttribute("data-autoplay"), 10) || 0;
			var timer = null;

			function show(index) {
				current = (index + slides.length) % slides.length;
				slides.forEach(function (s, i) {
					s.classList.toggle("is-active", i === current);
				});
				dots.forEach(function (d, i) {
					d.classList.toggle("is-active", i === current);
				});
			}

			function next() {
				show(current + 1);
			}
			function prev() {
				show(current - 1);
			}

			function startAuto() {
				if (!autoplay) return;
				stopAuto();
				timer = setInterval(next, autoplay);
			}
			function stopAuto() {
				if (timer) {
					clearInterval(timer);
					timer = null;
				}
			}

			if (prevBtn)
				prevBtn.addEventListener("click", function () {
					prev();
					startAuto();
				});
			if (nextBtn)
				nextBtn.addEventListener("click", function () {
					next();
					startAuto();
				});
			dots.forEach(function (d, i) {
				d.addEventListener("click", function () {
					show(i);
					startAuto();
				});
			});

			carousel.addEventListener("mouseenter", stopAuto);
			carousel.addEventListener("mouseleave", startAuto);
			carousel.addEventListener("focusin", stopAuto);
			carousel.addEventListener("focusout", startAuto);

			carousel.addEventListener("keydown", function (e) {
				if (e.key === "ArrowLeft") {
					e.preventDefault();
					prev();
					startAuto();
				} else if (e.key === "ArrowRight") {
					e.preventDefault();
					next();
					startAuto();
				}
			});

			// 尊重「减少动效」偏好：关闭自动播放
			if (
				window.matchMedia &&
				window.matchMedia("(prefers-reduced-motion: reduce)").matches
			) {
				autoplay = 0;
			}

			startAuto();
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initPaperFeatured);
	} else {
		initPaperFeatured();
	}

	// 2026-10-06：移除 swup 后站点回到浏览器原生整页刷新，脚本每次跳转都会
	// 重新执行，原 page:view / content:replace / swup:page:view 三个
	// 「无刷新换页后重新初始化」钩子已无触发可能，故一并删除。
	// 保留 bfcache 恢复兜底（从缓存取回页面时脚本不重跑）。
	window.addEventListener("pageshow", function (event) {
		if (event.persisted) initPaperFeatured();
	});
})();
