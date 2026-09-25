/**
 * GitHub 仓库卡片水合脚本
 *
 * 为什么需要它：文章的 ::github{repo="owner/repo"} 由
 * src/plugins/remark-github-card.mjs 编译成「骨架卡片」静态 HTML：
 *
 *   <a class="card-github fetch-waiting no-styling" href="https://github.com/owner/repo">
 *     ... <div class="gc-description">Loading...</div> <div class="gc-infobar">— ...</div>
 *
 * 样式里 .card-github.fetch-waiting 会把描述/信息栏渲染成灰底脉冲条（骨架）。
 * 骨架必须由脚本在拿到数据后摘掉，但站点里原本没有任何脚本做这件事，
 * 所以卡片永远停在骨架状态。
 *
 * 本脚本负责：
 *   1. 扫描页面上所有 a.card-github，用 /api/github-card 代理取数据（不再直连 api.github.com）；
 *   2. 填充描述 / star / fork / license / 头像，摘掉 fetch-waiting；
 *   3. 取不到数据时加 fetch-error（样式里已有「（加载失败）」提示），卡片本身仍是可点的链接；
 *   4. 结果写进 sessionStorage，Swup 站内跳转来回切换时不会重复请求。
 *
 * 加载方式：Layout.astro 中 <script is:inline defer src="/js/github-card.js?v=1">
 */
(function () {
	"use strict";

	var API = "/api/github-card?repo=";
	var FALLBACK_API = "https://api.github.com/repos/";
	var STORE_KEY = "yuj_gh_card_v1";
	var STORE_TTL = 30 * 60 * 1000; // 前端缓存 30 分钟
	var inflight = {};

	function readStore() {
		try {
			var raw = sessionStorage.getItem(STORE_KEY);
			var obj = raw ? JSON.parse(raw) : {};
			return obj && typeof obj === "object" ? obj : {};
		} catch (e) {
			return {};
		}
	}

	function writeStore(store) {
		try {
			sessionStorage.setItem(STORE_KEY, JSON.stringify(store));
		} catch (e) {
			/* sessionStorage 满或被禁用时忽略，不影响功能 */
		}
	}

	var store = readStore();

	function cached(repo) {
		var rec = store[repo];
		if (!rec) return null;
		if (!rec.at || Date.now() - rec.at > STORE_TTL) return null;
		return rec.data || null;
	}

	function repoOf(el) {
		var d = el.getAttribute("data-repo");
		if (d && d.indexOf("/") > 0) return d.trim();
		var href = el.getAttribute("href") || "";
		var m = href.match(/github\.com\/([^\/\?#]+)\/([^\/\?#]+)/i);
		return m ? m[1] + "/" + m[2] : "";
	}

	function compact(n) {
		var v = Number(n);
		if (!isFinite(v)) return "—";
		try {
			return Intl.NumberFormat("en", {
				notation: "compact",
				maximumFractionDigits: 1,
			})
				.format(v)
				.replace(/\u202f|\s/g, "");
		} catch (e) {
			return String(v);
		}
	}

	function fill(el, data) {
		var desc = el.querySelector(".gc-description");
		if (desc) desc.textContent = data.description || "这个仓库还没有写简介。";

		var lang = el.querySelector(".gc-language");
		if (lang) lang.textContent = data.language || "—";

		var stars = el.querySelector(".gc-stars");
		if (stars) stars.textContent = compact(data.stars);
		var forks = el.querySelector(".gc-forks");
		if (forks) forks.textContent = compact(data.forks);
		var license = el.querySelector(".gc-license");
		if (license) license.textContent = data.license || "no-license";

		var avatar = el.querySelector(".gc-avatar");
		if (avatar && data.avatar) {
			avatar.style.backgroundImage = "url(" + data.avatar + ")";
			avatar.style.backgroundColor = "transparent";
		}

		if (data.html_url) el.setAttribute("href", data.html_url);

		el.classList.remove("fetch-waiting");
		el.classList.add("fetch-done");
		el.setAttribute("data-gc-state", "done");
	}

	function fail(el) {
		el.classList.remove("fetch-waiting");
		el.classList.add("fetch-error");
		el.setAttribute("data-gc-state", "error");
		// 让样式里的「（加载失败）」伪元素单独显示，避免和占位文案叠在一起
		var desc = el.querySelector(".gc-description");
		if (desc) desc.textContent = "";
	}

	function request(repo) {
		return fetch(API + encodeURIComponent(repo), { credentials: "same-origin" })
			.then(function (r) {
				if (!r.ok) throw new Error("proxy " + r.status);
				return r.json();
			})
			.then(function (j) {
				if (!j || !j.ok) throw new Error((j && j.error) || "bad payload");
				return j;
			})
			.catch(function () {
				// 代理不可用（比如函数还没部署）时退回直连 api.github.com，
				// 国内网络下大概率也会失败，但至少不额外制造问题。
				return fetch(FALLBACK_API + repo, { referrerPolicy: "no-referrer" })
					.then(function (r) {
						if (!r.ok) throw new Error("direct " + r.status);
						return r.json();
					})
					.then(function (d) {
						return {
							ok: true,
							description: d.description || "",
							language: d.language || "",
							stars: d.stargazers_count || 0,
							forks: d.forks_count || 0,
							license: (d.license && d.license.spdx_id) || "",
							avatar: (d.owner && d.owner.avatar_url) || "",
							html_url: d.html_url || "",
						};
					});
			});
	}

	function hydrate(repo) {
		if (inflight[repo]) return inflight[repo];

		var hit = cached(repo);
		if (hit) return Promise.resolve(hit);

		inflight[repo] = request(repo)
			.then(function (data) {
				store[repo] = { at: Date.now(), data: data };
				writeStore(store);
				return data;
			})
			.then(
				function (data) {
					delete inflight[repo];
					return data;
				},
				function (err) {
					delete inflight[repo];
					throw err;
				}
			);

		return inflight[repo];
	}

	function scan(root) {
		var scope = root && root.querySelectorAll ? root : document;
		var nodes = scope.querySelectorAll("a.card-github, .card-github");
		var list = [];
		for (var i = 0; i < nodes.length; i++) {
			var el = nodes[i];
			// data-gc-state 一旦写上（loading/done/error）就不再重复处理，
			// 避免 Swup 多次触发事件时对同一张卡片重复发请求。
			if (el.getAttribute("data-gc-state")) continue;
			list.push(el);
		}

		list.forEach(function (el) {
			var repo = repoOf(el);
			if (!repo) {
				fail(el);
				return;
			}
			el.setAttribute("data-gc-state", "loading");
			hydrate(repo).then(
				function (data) {
					fill(el, data);
				},
				function () {
					fail(el);
				}
			);
		});
	}

	function run() {
		// 卡片是编译进正文 HTML 的，Swup 替换正文后需要重新扫一遍
		scan(document);
	}

	// Swup 站内跳转：正文被替换后重新水合
	["swup:page:view", "swup:content:replace", "swup:enable", "swup:visit:end"].forEach(
		function (evt) {
			document.addEventListener(evt, run);
		}
	);

	// Swup 的 hooks 一旦可用也挂上（双保险，钩子不存在不影响）
	document.addEventListener("swup:enable", function () {
		try {
			if (window.swup && window.swup.hooks && window.swup.hooks.on) {
				window.swup.hooks.on("page:view", run);
			}
		} catch (e) {
			/* 忽略 */
		}
	});

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", run);
	} else {
		run();
	}
})();
