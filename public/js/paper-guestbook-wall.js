/* ============================================================================
 *  留言墙渲染器 —— 照搬 Homulilly / hexo-theme-flatpaper 的 renderGuestbookWall()
 * ----------------------------------------------------------------------------
 *  源码依据：homulilly.com/js/main.js 第 526~961 行
 *  职责：读取 <section class="guestbook-wall" data-guestbook-system="twikoo">
 *        上的 data-* 配置，调用 Twikoo 的 getRecentComments / getCommentsCount，
 *        把评论渲染成便签卡贴到墙上，并支持"展开更多"与"随机/时间"排序切换。
 *
 *  与原版的差异（仅为适配本站，逻辑等价）：
 *    1. 原版依赖全局 t()（FLATPAPER_I18N）。本站没有该字典，改为内联常量，
 *       文案与 homulilly 一致。
 *    2. 原版依赖 safeRemoteUrl() 做 URL 白名单校验。此处内联同等实现
 *       （只允许 http/https，防 javascript: 注入）。
 *    3. 原版在 <body> 末尾一次性执行。本站用 Swup 做无刷新页面过渡，
 *       故挂到 swup:page:view 上，保证切页后重新渲染。
 * ========================================================================= */

(function () {
	"use strict";

	// ---- 文案（照搬 homulilly FLATPAPER_I18N 的 guestbook.* 键） ----
	var I18N = {
		loading: "正在铺开留言墙…",
		load_failed: "留言加载失败，请稍后再试。",
		empty: "墙上还空着，来贴第一张留言吧！",
		load_more: "展开更多留言",
		total_count: "共 {n} 条留言",
		latest_note: "墙上展示最新 {n} 条",
		jump_to_comment: "查看留言",
		sort_time: "查看最新",
		sort_random: "随机排序",
		anonymous: "匿名访客",
	};

	function t(key, value) {
		var s = I18N[key] || "";
		return value === undefined ? s : s.replace("{n}", String(value));
	}

	// ---- URL 白名单（只放行 http/https，避免 javascript:/data: 注入） ----
	function safeRemoteUrl(raw, kind) {
		if (!raw) return "";
		var s = String(raw).trim();
		if (!s) return "";
		var lower = s.toLowerCase();
		if (
			lower.indexOf("javascript:") === 0 ||
			lower.indexOf("data:") === 0 ||
			lower.indexOf("vbscript:") === 0
		) {
			return "";
		}
		if (kind === "image" && lower.indexOf("//") === 0) return "https:" + s;
		if (lower.indexOf("http://") === 0 || lower.indexOf("https://") === 0 || s.charAt(0) === "/") {
			return s;
		}
		return "";
	}

	function renderGuestbookWall() {
		var walls = document.querySelectorAll(".guestbook-wall[data-guestbook-system]");
		if (!walls.length) return;

		Array.prototype.forEach.call(walls, function (wall) {
			// 已经初始化过就跳过（Swup 切页回来时不重复挂载）
			if (wall.dataset.gbReady === "1") {
				// 但若墙是空的（上次失败），允许重试一次
				var existing = wall.querySelector("[data-guestbook-list]");
				if (existing && existing.children.length) return;
			}

			var system = String(wall.dataset.guestbookSystem || "").toLowerCase();
			var state = wall.querySelector("[data-guestbook-state]");
			var list = wall.querySelector("[data-guestbook-list]");
			var more = wall.querySelector("[data-guestbook-more]");
			var summary = wall.querySelector(".guestbook-wall__summary");
			var sortBtn = wall.querySelector("[data-guestbook-sort]");
			if (!state || !list || !more) return;

			var avatarFallback = safeRemoteUrl(wall.dataset.avatarFallback, "image");
			var pageSize = parseInt(wall.dataset.pageSize, 10);
			if (!pageSize || pageSize < 1) pageSize = 12;

			var shown = 0;
			var messages = [];
			var originalMessages = [];
			var isRandom = true;
			var truncated = false;

			function shuffleArray(array) {
				var a = array.slice();
				for (var i = a.length - 1; i > 0; i--) {
					var j = Math.floor(Math.random() * (i + 1));
					var temp = a[i];
					a[i] = a[j];
					a[j] = temp;
				}
				return a;
			}

			function updateSortButton() {
				if (!sortBtn) return;
				sortBtn.hidden = false;
				var iconTime =
					'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:middle;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
				var iconShuffle =
					'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:middle;"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';
				sortBtn.innerHTML =
					(isRandom ? iconTime : iconShuffle) +
					"<span>" +
					(isRandom ? t("sort_time") : t("sort_random")) +
					"</span>";
			}

			if (sortBtn) {
				sortBtn.addEventListener("click", function () {
					isRandom = !isRandom;
					messages = isRandom ? shuffleArray(originalMessages) : originalMessages.slice();
					list.classList.toggle("guestbook-wall__list--grid", !isRandom);
					list.innerHTML = "";
					shown = 0;
					updateSortButton();
					renderNext();
				});
			}

			// Twikoo 评论区挂载点（下方 .comments-section 内）
			var mountId = system === "artalk" ? "artalk-comments" : "tcomment";

			var PAPER_COUNT = 5;
			var ROTATION_COUNT = 8;

			function setState(message, isError) {
				state.textContent = message || "";
				state.hidden = !message;
				state.classList.toggle("is-error", !!isError);
			}

			function hashSeed(text) {
				var hash = 5381;
				var source = String(text || "");
				for (var i = 0; i < source.length; i++) {
					hash = ((hash << 5) + hash + source.charCodeAt(i)) >>> 0;
				}
				return hash;
			}

			function formatDate(created) {
				if (!created) return "";
				var date = new Date(created);
				if (isNaN(date.getTime())) return "";
				try {
					return date.toLocaleDateString(document.documentElement.lang || undefined, {
						year: "numeric",
						month: "short",
						day: "numeric",
					});
				} catch (e) {
					return date.toISOString().slice(0, 10);
				}
			}

			function normalizeCommentImage(src, isEmotion) {
				var safeSrc = safeRemoteUrl(src, "image");
				if (!safeSrc) return null;
				return { src: safeSrc, isEmotion: !!isEmotion };
			}

			function fallbackAvatar(nick) {
				var span = document.createElement("span");
				span.className = "guestbook-card__avatar guestbook-card__avatar--text";
				span.setAttribute("aria-hidden", "true");
				var glyph = Array.from(String(nick || "").trim())[0] || "✿";
				span.textContent = glyph.toLocaleUpperCase ? glyph.toLocaleUpperCase() : glyph;
				return span;
			}

			function stampAvatar(avatar) {
				var stamp = document.createElement("span");
				stamp.className = "guestbook-card__stamp";
				stamp.setAttribute("aria-hidden", "true");
				stamp.appendChild(avatar);
				return stamp;
			}

			function jumpToComment(anchorId) {
				var target = anchorId ? document.getElementById(anchorId) : null;
				var precise = !!target;
				if (!target) target = document.getElementById(mountId);
				if (!target) return;
				var reduceMotion =
					window.matchMedia &&
					window.matchMedia("(prefers-reduced-motion: reduce)").matches;
				target.scrollIntoView({
					behavior: reduceMotion ? "auto" : "smooth",
					block: "center",
				});
				if (precise) {
					target.classList.add("guestbook-jump-target");
					window.setTimeout(function () {
						target.classList.remove("guestbook-jump-target");
					}, 1600);
				}
			}

			function createCard(message) {
				var seed = hashSeed(message.anchorId || message.nick + message.created);
				var item = document.createElement("li");
				item.className = "guestbook-card-wrap";

				var card = document.createElement("div");
				// 角度/配色/位移全部只由 seed 决定 —— 刷新与重新排序都不会跳版
				var rotationIndex = seed % ROTATION_COUNT;
				card.className =
					"guestbook-card guestbook-card--p" + (seed % PAPER_COUNT) +
					" guestbook-card--r" + rotationIndex;

				var tx = (seed % 7) - 3;
				var ty = ((seed * 7) % 7) - 3;
				card.style.setProperty("--gb-tx", tx + "px");
				card.style.setProperty("--gb-ty", ty + "px");

				var meta = document.createElement("div");
				meta.className = "guestbook-card__meta";

				if (message.avatar) {
					var img = document.createElement("img");
					img.className = "guestbook-card__avatar";
					img.src = message.avatar;
					img.alt = "";
					img.loading = "lazy";
					img.referrerPolicy = "no-referrer";
					img.addEventListener("error", function () {
						if (
							avatarFallback &&
							img.dataset.fpAvatarFallback !== "1" &&
							img.src !== avatarFallback
						) {
							img.dataset.fpAvatarFallback = "1";
							img.src = avatarFallback;
							return;
						}
						if (img.parentNode) img.parentNode.replaceChild(fallbackAvatar(message.nick), img);
					});
					meta.appendChild(stampAvatar(img));
				} else {
					meta.appendChild(stampAvatar(fallbackAvatar(message.nick)));
				}

				var who = document.createElement("div");
				who.className = "guestbook-card__who";
				var nick = document.createElement("span");
				nick.className = "guestbook-card__nick";
				nick.textContent = message.nick;
				who.appendChild(nick);
				var dateLabel = formatDate(message.created);
				if (dateLabel) {
					var time = document.createElement("time");
					time.className = "guestbook-card__date";
					time.textContent = dateLabel;
					time.dateTime = new Date(message.created).toISOString();
					if (message.relativeTime) time.title = message.relativeTime;
					who.appendChild(time);
				}
				meta.appendChild(who);
				card.appendChild(meta);

				if (message.text) {
					var text = document.createElement("p");
					text.className = "guestbook-card__text";
					text.textContent = message.text;
					card.appendChild(text);
				}

				if (message.images && message.images.length > 0) {
					var imgContainer = document.createElement("div");
					imgContainer.className = "guestbook-card__images";
					var hasFancybox =
						document.documentElement.getAttribute("data-fancybox-enabled") === "1";
					message.images.forEach(function (imgData) {
						var src = safeRemoteUrl(
							typeof imgData === "string" ? imgData : imgData.src,
							"image"
						);
						if (!src) return;
						var isEmotion = typeof imgData === "object" && imgData.isEmotion;
						var image = document.createElement("img");
						image.src = src;
						image.alt = "";
						image.loading = "lazy";
						image.referrerPolicy = "no-referrer";
						image.className = isEmotion
							? "guestbook-card__image guestbook-card__image--emotion"
							: "guestbook-card__image";
						if (hasFancybox && !isEmotion) {
							var a = document.createElement("a");
							a.href = src;
							a.setAttribute("data-fancybox", "guestbook-wall");
							a.appendChild(image);
							imgContainer.appendChild(a);
						} else {
							imgContainer.appendChild(image);
						}
					});
					card.appendChild(imgContainer);
				}

				var jump = document.createElement("a");
				jump.className = "guestbook-card__jump";
				jump.href = "#" + mountId;
				jump.textContent = t("jump_to_comment");
				jump.addEventListener("click", function (event) {
					event.preventDefault();
					jumpToComment(message.anchorId);
				});
				card.appendChild(jump);

				// 约一半卡片带一个手绘小涂鸦
				if (seed % 2 === 0) {
					var doodles = [
						'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5c-4.5-4-9-8-9-12.5 0-2.5 2-4.5 4.5-4.5 2 0 3.5 1.5 4.5 3 1-1.5 2.5-3 4.5-3 2.5 0 4.5 2 4.5 4.5 0 4.5-4.5 8.5-9 12.5z"/></svg>',
						'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 7h7l-5.5 4.5 2 7.5-6-5-6 5 2-7.5-5.5-4.5h7z"/></svg>',
						'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
						'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6l6 6-6 6"/></svg>',
					];
					var doodleIndex = (seed % 11) % doodles.length;
					var posIndex = (seed % 17) % 5;
					var doodleWrapper = document.createElement("div");
					doodleWrapper.className = "guestbook-card__doodle guestbook-card__doodle--pos" + posIndex;
					doodleWrapper.setAttribute("aria-hidden", "true");
					doodleWrapper.innerHTML = doodles[doodleIndex];
					card.appendChild(doodleWrapper);
				}

				item.appendChild(card);
				return item;
			}

			function renderNext() {
				var next = messages.slice(shown, shown + pageSize);
				next.forEach(function (message) {
					list.appendChild(createCard(message));
				});
				shown += next.length;
				more.hidden = shown >= messages.length;
			}

			function updateSummary(total) {
				var totalEl = wall.querySelector('[data-guestbook-stat="total"]');
				if (totalEl && typeof total === "number") totalEl.textContent = t("total_count", total);
				var shownEl = wall.querySelector('[data-guestbook-stat="shown"]');
				if (shownEl && truncated) {
					shownEl.textContent = t("latest_note", messages.length);
					shownEl.hidden = false;
				}
				if (summary) summary.hidden = false;
			}

			// 适配器统一返回 { messages, total, truncated }
			var adapters = {
				twikoo: function () {
					var envId = wall.dataset.guestbookEnv;
					if (!envId) return Promise.reject(new Error("twikoo: missing envId"));
					// Twikoo SDK 用 defer 从 CDN 加载，本脚本可能先执行 —— 轮询等待
					return new Promise(function (resolve, reject) {
						var waited = 0;
						(function poll() {
							if (window.twikoo && typeof window.twikoo.getRecentComments === "function") {
								resolve();
								return;
							}
							waited += 250;
							if (waited >= 15000) {
								reject(new Error("twikoo: sdk timeout"));
								return;
							}
							window.setTimeout(poll, 250);
						})();
					}).then(function () {
						// Twikoo 默认以 location.pathname 作 pageKey，
						// 这样墙与下方评论框读的是同一个桶
						var pageKey = window.location.pathname || "/";
						return window.twikoo
							.getRecentComments({
								envId: envId,
								urls: [pageKey],
								pageSize: 100,
								includeReply: false,
							})
							.then(function (raw) {
								var items = Array.isArray(raw) ? raw : [];
								var normalized = items
									.map(function (item) {
										// 用 DOMParser 解析（不挂到活的元素上），
										// 这样 <img onerror> 之类的内联处理器不会被触发
										var doc = new DOMParser().parseFromString(
											String(item.comment || ""),
											"text/html"
										);
										var images = [];
										Array.prototype.forEach.call(doc.querySelectorAll("img"), function (img) {
											var cls = img.className || "";
											var src = img.getAttribute("src") || "";
											var isEmotion =
												cls.indexOf("emotion") !== -1 ||
												cls.indexOf("sticker") !== -1 ||
												src.indexOf("bilibili") !== -1 ||
												src.indexOf("tieba") !== -1;
											var image = normalizeCommentImage(src, isEmotion);
											if (image) images.push(image);
										});
										var text = (doc.body.textContent || "").trim();
										if (!text && !images.length) return null;
										var created = item.created;
										if (typeof created !== "number") created = parseInt(created, 10) || 0;
										return {
											anchorId: String(item.id || ""),
											nick: String(item.nick || "").trim() || t("anonymous"),
											avatar: safeRemoteUrl(item.avatar, "image"),
											text: text,
											images: images,
											created: created,
											relativeTime: String(item.relativeTime || ""),
										};
									})
									.filter(Boolean);

								var result = {
									messages: normalized,
									total: normalized.length,
									truncated: items.length >= 100,
								};
								if (typeof window.twikoo.getCommentsCount !== "function") return result;
								return window.twikoo
									.getCommentsCount({
										envId: envId,
										urls: [pageKey],
										includeReply: true,
									})
									.then(function (counts) {
										var entry = Array.isArray(counts) ? counts[0] : null;
										if (entry && typeof entry.count === "number") result.total = entry.count;
										return result;
									})
									.catch(function () {
										return result;
									});
							});
					});
				},
			};

			if (!adapters[system]) return;

			more.addEventListener("click", renderNext);
			more.textContent = t("load_more");
			setState(t("loading"));

			wall.dataset.gbReady = "1";

			adapters[system]()
				.then(function (result) {
					originalMessages = result.messages || [];
					messages = isRandom ? shuffleArray(originalMessages) : originalMessages.slice();
					truncated = !!result.truncated;
					list.innerHTML = "";
					shown = 0;
					if (!messages.length) {
						setState(t("empty"));
						return;
					}
					setState("");
					list.classList.toggle("guestbook-wall__list--grid", !isRandom);
					updateSortButton();
					renderNext();
					updateSummary(result.total);
				})
				.catch(function () {
					setState(t("load_failed"), true);
					delete wall.dataset.gbReady;
				});
		});
	}

	// 首次加载
	renderGuestbookWall();

	// Swup 页面过渡后重新渲染（回到留言板时墙上要重新铺）
	document.addEventListener("swup:page:view", function () {
		renderGuestbookWall();
	});
	document.addEventListener("swup:content:replace", function () {
		renderGuestbookWall();
	});
})();
