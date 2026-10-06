/**
 * paper-search.js —— flatpaper 同款搜索弹窗（1:1 视觉移植 search-panel）
 *
 * 结构/样式：src/styles/paper-header.css 的「#paper-search-root 搜索弹窗」段
 * 后端：pagefind（本站构建已生成 /pagefind/ 索引，Astro build 产物）；
 *       pagefind 不可用时回退 /api/allPostMeta.json（标题 + 摘要匹配）。
 * 绑定：document capture 阶段委托 .js-search-open —— 与页面切换方式解耦，
 *       并阻断 PaperHeader 内联脚本 / paper-header.js 对旧 Search 组件的转发。
 * 弹窗 DOM 首次打开时创建并挂在 body 直下（站点已改回整页刷新，
 * 每次进入页面都会重新创建；懒创建只为避免首屏无谓的 DOM 开销）。
 */
(function () {
	"use strict";

	var panel = null;
	var input = null;
	var results = null;
	var pagefind = null; // 加载后的 pagefind API
	var pagefindState = "idle"; // idle | loading | ready | error
	var fallbackState = "idle"; // 兜底索引：idle | loading | ready | error
	var fallbackPosts = [];
	var debounceTimer = null;
	var lastQuery = "";

	var ICON_SEARCH =
		'<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>';
	var ICON_CLOSE =
		'<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';

	function el(tag, cls, text) {
		var node = document.createElement(tag);
		if (cls) node.className = cls;
		if (text != null) node.textContent = text;
		return node;
	}

	function buildPanel() {
		if (panel) return;

		panel = el("div", "fp-search-panel");
		panel.id = "paper-search-root";
		panel.setAttribute("aria-hidden", "true");

		var backdrop = el("div", "search-backdrop js-search-close");

		var dialog = el("section", "search-dialog");
		dialog.setAttribute("role", "dialog");
		dialog.setAttribute("aria-modal", "true");
		dialog.setAttribute("aria-label", "搜索文章");

		// 胶带（.tape--top-left 来自 paper-theme.css，1:1 同参考站）
		var tape = el("span", "tape tape--top-left");
		tape.setAttribute("aria-hidden", "true");

		var head = el("header", "search-head");
		var h2 = el("h2");
		h2.appendChild(el("span", "green-dot"));
		h2.appendChild(document.createTextNode("搜索文章"));
		var closeBtn = el("button", "icon-button js-search-close");
		closeBtn.type = "button";
		closeBtn.setAttribute("aria-label", "关闭搜索");
		closeBtn.innerHTML = ICON_CLOSE;
		head.appendChild(h2);
		head.appendChild(closeBtn);

		var field = el("label", "search-field");
		field.insertAdjacentHTML("afterbegin", ICON_SEARCH);
		input = el("input", "search-input");
		input.id = "paper-search-input";
		input.type = "search";
		input.placeholder = "输入关键词，按 Esc 关闭";
		input.autocomplete = "off";
		field.appendChild(input);

		results = el("div", "search-results");
		results.setAttribute("data-empty", "输入关键词后显示匹配的文章");
		results.appendChild(el("p", "search-empty", "输入关键词后显示匹配的文章"));

		dialog.appendChild(tape);
		dialog.appendChild(head);
		dialog.appendChild(field);
		dialog.appendChild(results);
		panel.appendChild(backdrop);
		panel.appendChild(dialog);
		document.body.appendChild(panel);

		panel.querySelectorAll(".js-search-close").forEach(function (btn) {
			btn.addEventListener("click", closePanel);
		});
		input.addEventListener("input", function () {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(function () {
				render(input.value);
			}, 120);
		});
	}

	/* ---------------- pagefind 加载 ---------------- */
	function dynamicImportPagefind() {
		// pagefind 官方入口是 ES module，动态 import 拿导出的 API
		import("/pagefind/pagefind.js")
			.then(function (mod) {
				var api = mod && (mod.default || mod);
				if (api && typeof api.search === "function") {
					pagefind = api;
					pagefindState = "ready";
				} else if (
					window.pagefind &&
					typeof window.pagefind.search === "function"
				) {
					pagefind = window.pagefind;
					pagefindState = "ready";
				} else {
					pagefindState = "error";
				}
				if (input) render(input.value);
			})
			.catch(function () {
				pagefindState = "error";
				if (input) render(input.value);
			});
	}

	function loadPagefind() {
		if (pagefindState === "ready" || pagefindState === "loading") return;
		// 已就绪的 window.pagefind（Mizuki 加载器已注入、或宿主环境预置）直接用
		if (window.pagefind && typeof window.pagefind.search === "function") {
			pagefind = window.pagefind;
			pagefindState = "ready";
			return;
		}
		pagefindState = "loading";
		// Mizuki 的加载器若存在（window.loadPagefind）优先用它：
		// 它会注入 /pagefind/pagefind.js 并派发 pagefindready 事件
		if (typeof window.loadPagefind === "function") {
			try {
				Promise.resolve(window.loadPagefind())
					.then(function () {
						if (
							window.pagefind &&
							typeof window.pagefind.search === "function"
						) {
							pagefind = window.pagefind;
							pagefindState = "ready";
							if (input) render(input.value);
						} else {
							dynamicImportPagefind();
						}
					})
					.catch(dynamicImportPagefind);
				return;
			} catch (e) {
				/* fall through 到动态 import */
			}
		}
		dynamicImportPagefind();
	}

	/* ---------------- 兜底索引（/api/allPostMeta.json） ---------------- */
	function loadFallback() {
		if (fallbackState !== "idle") return;
		fallbackState = "loading";
		fetch("/api/allPostMeta.json")
			.then(function (res) {
				if (!res.ok) throw new Error("HTTP " + res.status);
				return res.json();
			})
			.then(function (data) {
				fallbackPosts = Array.isArray(data) ? data : [];
				fallbackState = "ready";
				if (input) render(input.value);
			})
			.catch(function () {
				fallbackState = "error";
				if (input) render(input.value);
			});
	}

	function fmtDate(ts) {
		try {
			var d = new Date(ts);
			var p = function (n) {
				return (n < 10 ? "0" : "") + n;
			};
			return (
				d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
			);
		} catch (e) {
			return "";
		}
	}

	/* ---------------- 高亮（照搬 flatpaper main.js appendHighlighted） ----------------
	   纯 textContent + <mark>，不做 HTML 解析，标题/摘要里的特殊字符无注入面 */
	function appendHighlighted(parent, text, keyword) {
		if (!text) return;
		if (!keyword) {
			parent.appendChild(document.createTextNode(text));
			return;
		}
		var lower = text.toLowerCase();
		// toLowerCase() 对个别字符不保长（如 'İ'），索引会错位 —— 此时跳过高亮
		if (lower.length !== text.length) {
			parent.appendChild(document.createTextNode(text));
			return;
		}
		var i = 0;
		var idx;
		while ((idx = lower.indexOf(keyword, i)) !== -1) {
			if (idx > i)
				parent.appendChild(document.createTextNode(text.slice(i, idx)));
			var mark = document.createElement("mark");
			mark.textContent = text.slice(idx, idx + keyword.length);
			parent.appendChild(mark);
			i = idx + keyword.length;
		}
		if (i < text.length)
			parent.appendChild(document.createTextNode(text.slice(i)));
	}

	/* ---------------- 渲染 ---------------- */
	function pending(text) {
		results.innerHTML = "";
		results.appendChild(el("p", "search-empty", text));
	}

	function render(query) {
		if (!results) return;
		lastQuery = query;
		var raw = query.trim();
		var keyword = raw.toLowerCase();
		if (!keyword) {
			results.innerHTML = "";
			results.appendChild(
				el("p", "search-empty", "输入关键词后显示匹配的文章"),
			);
			return;
		}
		if (pagefindState === "ready" && pagefind) {
			renderPagefind(raw, keyword);
			return;
		}
		if (pagefindState === "loading") {
			pending("正在加载搜索索引…");
			return;
		}
		// pagefind 不可用 -> 兜底索引
		if (fallbackState === "idle") {
			loadFallback();
			pending("正在加载搜索索引…");
			return;
		}
		if (fallbackState === "loading") {
			pending("正在加载搜索索引…");
			return;
		}
		if (fallbackState === "error") {
			pending("搜索加载失败，请稍后重试");
			return;
		}
		renderFallback(raw, keyword);
	}

	function noResult(raw) {
		results.innerHTML = "";
		results.appendChild(
			el("p", "search-empty", "没有找到与「" + raw + "」匹配的文章"),
		);
	}

	function renderPagefind(raw, keyword) {
		pagefind
			.search(raw)
			.then(function (response) {
				if (lastQuery.trim().toLowerCase() !== keyword) return; // 过期响应
				var slice = response.results.slice(0, 8);
				Promise.all(
					slice.map(function (item) {
						return item.data();
					}),
				).then(function (datas) {
					if (lastQuery.trim().toLowerCase() !== keyword) return;
					results.innerHTML = "";
					if (!datas.length) {
						noResult(raw);
						return;
					}
					datas.forEach(function (data) {
						var a = el("a", "search-result");
						a.href = data.url || "#";
						var strong = document.createElement("strong");
						appendHighlighted(
							strong,
							(data.meta && data.meta.title) || "无标题",
							keyword,
						);
						a.appendChild(strong);
						var dateText =
							data.meta && (data.meta.date || data.meta.published);
						if (dateText) a.appendChild(el("span", null, dateText));
						var p = document.createElement("p");
						// pagefind 的 excerpt 自带 <mark> 高亮，直接插入
						// （与 Mizuki Search.svelte 的 {@html} 同用法）
						p.innerHTML = data.excerpt || "";
						a.appendChild(p);
						results.appendChild(a);
					});
				});
			})
			.catch(function () {
				pending("搜索出错，请稍后重试");
			});
	}

	function renderFallback(raw, keyword) {
		var hits = fallbackPosts
			.filter(function (post) {
				if (post.password) return false;
				return (
					(post.title && post.title.toLowerCase().indexOf(keyword) > -1) ||
					(post.description &&
						post.description.toLowerCase().indexOf(keyword) > -1)
				);
			})
			.slice(0, 8);
		results.innerHTML = "";
		if (!hits.length) {
			noResult(raw);
			return;
		}
		hits.forEach(function (post) {
			var a = el("a", "search-result");
			a.href = "/posts/" + post.id + "/";
			var strong = document.createElement("strong");
			appendHighlighted(strong, post.title || "", keyword);
			a.appendChild(strong);
			if (post.published)
				a.appendChild(el("span", null, fmtDate(post.published)));
			var p = document.createElement("p");
			appendHighlighted(p, post.description || "", keyword);
			a.appendChild(p);
			results.appendChild(a);
		});
	}

	/* ---------------- 开合 ---------------- */
	function openPanel() {
		buildPanel();
		loadPagefind();
		panel.classList.add("is-open");
		panel.setAttribute("aria-hidden", "false");
		document.body.classList.add("fp-search-lock");
		setTimeout(function () {
			if (input) input.focus();
		}, 60);
		render(input ? input.value : "");
	}

	function closePanel() {
		if (!panel) return;
		panel.classList.remove("is-open");
		panel.setAttribute("aria-hidden", "true");
		document.body.classList.remove("fp-search-lock");
	}

	// capture 阶段委托：与页面切换方式解耦；stopPropagation 让事件到不了
	// 按钮上的旧转发监听（PaperHeader 内联脚本 / paper-header.js）
	document.addEventListener(
		"click",
		function (event) {
			var trigger =
				event.target &&
				event.target.closest &&
				event.target.closest(".js-search-open");
			if (!trigger) return;
			event.preventDefault();
			event.stopPropagation();
			openPanel();
		},
		true,
	);

	document.addEventListener("keydown", function (event) {
		if (event.key !== "Escape") return;
		if (!panel || !panel.classList.contains("is-open")) return;
		closePanel();
		event.stopPropagation();
	});
})();
