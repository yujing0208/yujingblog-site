/**
 * Swup 钩子模块
 * 处理页面过渡过程中的各种钩子事件
 */

import { pathsEqual, url } from "../../utils/url-utils";
import type { FancyboxHandler } from "../handlers/fancybox-handler";
import type { ScrollHandler } from "../handlers/scroll-handler";
import {
	ANIMATION_CONFIG,
	BANNER_HEIGHT,
	SWUP_SELECTORS,
	THEME_CONFIG,
} from "./swup-config";

// 钩子处理器接口
export interface SwupHookHandlers {
	fancyboxHandler?: FancyboxHandler;
	scrollHandler?: ScrollHandler;
	showBanner?: () => void;
	initFancybox?: () => void;
	cleanupFancybox?: () => void;
	initCustomScrollbar?: () => void;
	checkKatex?: () => void;
}

// 访问对象类型
interface VisitObject {
	to: {
		url: string;
	};
}

/**
 * Swup 钩子管理器
 * 负责注册和管理所有 Swup 页面过渡钩子
 */
export class SwupHooksManager {
	private bannerEnabled: boolean;
	private handlers: SwupHookHandlers;

	private cachedElements: Map<string, Element | null> = new Map();

	constructor(bannerEnabled: boolean, handlers: SwupHookHandlers = {}) {
		this.bannerEnabled = bannerEnabled;
		this.handlers = handlers;
	}

	private getCachedElement(selector: string): Element | null {
		if (!this.cachedElements.has(selector)) {
			const id = selector.startsWith("#") ? selector.slice(1) : selector;
			if (selector.startsWith("#")) {
				this.cachedElements.set(selector, document.getElementById(id));
			} else {
				this.cachedElements.set(
					selector,
					document.querySelector(selector),
				);
			}
		}
		return this.cachedElements.get(selector) ?? null;
	}

	private clearCache(): void {
		this.cachedElements.clear();
	}

	/**
	 * 注册所有 Swup 钩子
	 */
	registerHooks(): void {
		if (!window.swup) {
			return;
		}
		this.registerLayoutGuardHook();
		this.registerScrollTopHook();
		this.registerLinkClickHook();
		this.registerContentReplaceHook();
		this.registerVisitStartHook();
		this.registerPageViewHook();
		this.registerVisitEndHook();
		this.updatePageOverlay();
	}

	private registerScrollTopHook(): void {
		const hooks = window.swup!.hooks as {
			on: (event: string, handler: (...args: unknown[]) => void) => void;
			off: (event: string, handler: (...args: unknown[]) => void) => void;
			replace?: (
				event: string,
				handler: (
					visit: VisitObject,
					args: { options?: ScrollIntoViewOptions },
				) => boolean,
			) => void;
		};

		if (typeof hooks.replace !== "function") {
			return;
		}

		hooks.replace(
			"scroll:top",
			(visit: VisitObject, args: { options?: ScrollIntoViewOptions }) => {
				const isFullscreen = this.getCurrentWallpaperMode() === "fullscreen";
				const isHomePage = pathsEqual(visit.to.url, url("/"));
				if (isFullscreen && !isHomePage) {
					const mainGrid = this.getCachedElement("#main-grid") as HTMLElement | null;
					if (mainGrid) {
						mainGrid.scrollIntoView({
							behavior: args.options?.behavior ?? "auto",
						});
						return true;
					}
				}

				window.scrollTo({
					top: 0,
					left: 0,
					...args.options,
				});
				return true;
			},
		);
	}

	/**
	 * link:click 钩子
	 * 处理链接点击时的初始状态
	 */
	private registerLinkClickHook(): void {
		window.swup!.hooks.on("link:click", ((...args: unknown[]) => {
			const hookArgs = args[1] as { el?: HTMLAnchorElement } | undefined;
			const href = hookArgs?.el?.getAttribute("href") || "";
			const targetPathname = (() => {
				try {
					return new URL(href, window.location.href).pathname;
				} catch {
					return href;
				}
			})();
			const isSamePage = pathsEqual(targetPathname, window.location.pathname);

			// 移除首次页面加载的延迟
			document.documentElement.style.setProperty(
				"--content-delay",
				"0ms",
			);

			if (isSamePage) {
				document.documentElement.classList.remove("is-page-transitioning");
			} else {
				document.documentElement.classList.add("is-page-transitioning");
			}

			// 处理 navbar 隐藏
			if (this.bannerEnabled) {
				this.handleNavbarHideOnLinkClick();
			}
		}) as (...args: unknown[]) => void);
	}

	/**
	 * content:replace 钩子
	 * 处理内容替换后的初始化
	 */
	private registerContentReplaceHook(): void {
		window.swup!.hooks.on("content:replace", () => {
			this.clearCache();
			this.syncMainContentPosition(
				pathsEqual(window.location.pathname, url("/")),
			);
			this.ensureNavbarVisibleForFullscreen();
			this.updatePageOverlay();

			// 新页面的 #page-overlay-data 已就位，立刻同步侧栏/右栏显隐，
			// 否则从归档页切走时右栏与目录卡会残留到过渡结束
			this.syncPageScopedChrome();

			// 初始化新页面的图片、公式、滚动条和 TOC
			this.handlers.initFancybox?.();
			this.handlers.checkKatex?.();
			this.handlers.initCustomScrollbar?.();

			// 处理 TOC 重新初始化
			this.handleTOCReinit();

			// 重新初始化 semifull 模式滚动检测
			this.reinitSemifullScrollDetection();
		});
	}

	/**
	 * visit:start 钩子
	 * 处理页面访问开始时的状态
	 */
	private registerVisitStartHook(): void {
		window.swup!.hooks.on("visit:start", ((...args: unknown[]) => {
			const visit = args[0] as VisitObject;
			// 清理上一页的 Fancybox
			this.handlers.cleanupFancybox?.();

			// 处理页面状态
			const isHomePage = pathsEqual(visit.to.url, url("/"));
			this.handleBodyClass(isHomePage);
			this.handleBannerTextVisibility(isHomePage);
			this.handleNavbarState(isHomePage);
			this.handleMobileBannerVisibility(isHomePage);
			this.syncMainContentPosition(isHomePage);
			this.ensureNavbarVisibleForFullscreen();

			// 扩展页面高度防止滚动动画跳跃
			this.extendPageHeight(false);

			// 隐藏 TOC
			this.hideTOC();
		}) as (...args: unknown[]) => void);
	}

	/**
	 * page:view 钩子
	 * 处理页面视图显示
	 */
	private registerPageViewHook(): void {
		window.swup!.hooks.on("page:view", () => {
			this.syncMainContentPosition(
				pathsEqual(window.location.pathname, url("/")),
			);
			this.ensureNavbarVisibleForFullscreen();
			this.updatePageOverlay();

			// 侧栏 / 右栏 / 网格列都在 <main> 之外，Swup 不替换它们，
			// 必须按新页面的 #page-overlay-data 标记重新同步显隐
			this.syncPageScopedChrome();

			// 扩展页面高度
			this.extendPageHeight(false);

			// 同步主题状态
			this.syncThemeState();

			// 触发页面加载完成事件
			this.dispatchPageLoadedEvent();
		});
	}

	/**
	 * visit:end 钩子
	 * 处理页面访问结束时的清理
	 */
	private registerVisitEndHook(): void {
		window.swup!.hooks.on("visit:end", (() => {
			setTimeout(() => {
				// 隐藏高度扩展元素
				this.extendPageHeight(true);

				// 显示 TOC
				this.showTOC();
				document.documentElement.classList.remove("is-page-transitioning");
			}, ANIMATION_CONFIG.heightExtendDelay);
		}) as (...args: unknown[]) => void);
	}

	// ==================== 私有辅助方法 ====================

	/**
	 * 同步「按页面类型变化、但位于 <main> 之外」的布局外壳。
	 *
	 * 背景（2026-10-06）：Swup 只替换 <main>，而以下元素都在它之外，
	 * 跨页后保留的是离开时的状态：
	 *   · html[data-page-is-post]     → 侧栏卡片显隐（分类/标签/统计卡）
	 *   · html[data-page-has-toc]     → 侧栏目录卡（toc 作用域：文章页 + 关于页）
	 *   · #main-grid[data-has-right-rail] → 右栏显隐 + 桌面三列/两列网格
	 * 三者的真值都写在 <main> 内的 #page-overlay-data 上（随新页面一起被替换），
	 * 这里读取后同步到外壳即可。
	 */
	private syncPageScopedChrome(): void {
		const data = document.getElementById("page-overlay-data");
		if (!data) {
			return;
		}
		const root = document.documentElement;
		const isPost = data.getAttribute("data-is-post") === "true";
		root.setAttribute("data-page-is-post", isPost ? "true" : "false");

		// 目录卡作用域：文章页（data-page-is-post=true）与关于页（显式 hasToc）
		// 都走 toc 作用域，由 data-page-has-toc 驱动显隐。这里按新页 #page-overlay-data
		// 同步该标记，跨页后侧栏的目录卡才会立即正确显示/隐藏。
		const hasToc = data.getAttribute("data-has-toc") === "true";
		root.setAttribute("data-page-has-toc", hasToc ? "true" : "false");

		const mainGrid = this.getCachedElement("#main-grid");
		if (mainGrid) {
			mainGrid.setAttribute(
				"data-has-right-rail",
				data.getAttribute("data-has-right-rail") === "true" ? "true" : "false",
			);
		}

		// 目录卡从隐藏变为显示时，需要在可见之后再建目录
		// （FlatpaperTOC 建目录时要读当前正文的标题）。
		// 文章页与关于页都走 toc 作用域，故按 data-page-has-toc 判定，
		// 派发目标改为 data-widget-scope="toc"（不再绑定 post 作用域，
		// 否则关于页的目录卡永远不会被触发重建）。
		if (hasToc) {
			setTimeout(() => {
				document
					.querySelectorAll("[data-card-toc-root]")
					.forEach((el) => {
						if (el.closest('[data-widget-scope="toc"]')) {
							el.dispatchEvent(new CustomEvent("card-toc:refresh"));
						}
					});
			}, ANIMATION_CONFIG.tocReadyDelay);
		}
	}

	/**
	 * 跨布局导航守卫（兜底）
	 * 手账首页(.paper-shell)与普通页面(#main-grid)的 DOM 骨架不同，Swup 只替换
	 * <main>，跨布局导航会导致页面结构残缺（回首页丢 hero/壳、进文章页丢网格）。
	 * astro.config.mjs 的 ignore 选项已拦截链接点击与 swup.navigate()，
	 * 但 popstate（浏览器后退/前进）在 swup 内部直接 createVisit+performNavigation，
	 * 绕过 ignoreVisit 检查 —— 必须在 visit:start 最早的钩子点兜底拦截。
	 */
	private registerLayoutGuardHook(): void {
		const hooks = window.swup!.hooks as unknown as {
			before?: (
				event: string,
				handler: (visit: {
					to: { url: string; hash?: string };
					history: { popstate: boolean };
				}) => boolean,
			) => void;
		};
		if (typeof hooks.before !== "function") {
			return;
		}
		hooks.before("visit:start", (visit) => {
			const targetUrl = visit?.to?.url || "";
			if (!this.isCrossLayoutNavigation(targetUrl)) {
				return true;
			}
			console.log(
				"SwupHooks: 跨布局导航，回退整页加载:",
				targetUrl,
			);
			if (visit?.history?.popstate) {
				// 浏览器后退/前进：地址栏已变为目标 URL，直接重载当前条目
				window.location.reload();
			} else {
				// 普通导航：中止 swup，整页加载目标页
				window.location.assign(targetUrl + (visit?.to?.hash || ""));
			}
			return false;
		});
	}

	/**
	 * 判断目标 URL 与当前页面是否属于不同布局
	 * 布局判定：站点根路径("/")为手账首页(paper 布局)，其余页面为网格布局
	 */
	private isCrossLayoutNavigation(targetUrl: string): boolean {
		try {
			const path = String(targetUrl).split("#")[0].split("?")[0];
			const targetIsPaperHome = path.replace(/^\/+|\/+$/g, "") === "";
			const currentIsPaperHome =
				!!document.querySelector(".paper-shell");
			return targetIsPaperHome !== currentIsPaperHome;
		} catch {
			return false;
		}
	}

	/**
	 * 处理链接点击时的 navbar 隐藏
	 */
	private handleNavbarHideOnLinkClick(): void {
		const navbar = this.getCachedElement(SWUP_SELECTORS.navbarWrapper);
		if (navbar) {
			const threshold = window.innerHeight * (BANNER_HEIGHT / 100) - 88;
			if (document.documentElement.scrollTop >= threshold) {
				navbar.classList.add("navbar-hidden");
			}
		}
	}

	/**
	 * 处理 TOC 重新初始化
	 */
	private handleTOCReinit(): void {
		const tocWrapper = this.getCachedElement(SWUP_SELECTORS.tocWrapper);
		// Round 19：右侧 toc-wrapper 已移除，改用 page-overlay-data 的 data-is-post
		// 判定文章页（由 MainGridLayout 按 postSlug 写入，swup 换页后随容器更新）
		const isArticlePage =
			tocWrapper !== null ||
			document
				.getElementById("page-overlay-data")
				?.getAttribute("data-is-post") === "true";

		if (isArticlePage) {
			const tocElement = this.getCachedElement(
				SWUP_SELECTORS.tableOfContents,
			);
			const hasDesktopTOC =
				tocElement && typeof (tocElement as any).init === "function";
			const hasMobileTOC =
				typeof (window as any).mobileTOCInit === "function";

			if (hasDesktopTOC || hasMobileTOC) {
				setTimeout(() => {
					if (hasDesktopTOC) {
						(tocElement as any).init();
					}
					if (hasMobileTOC) {
						(window as any).mobileTOCInit();
					}
				}, ANIMATION_CONFIG.tocReadyDelay);
			}
		}
	}

	/**
	 * 重新初始化 semifull 模式滚动检测
	 */
	private reinitSemifullScrollDetection(): void {
		const navbar = this.getCachedElement(SWUP_SELECTORS.navbar);
		if (navbar) {
			const transparentMode = navbar.getAttribute(
				"data-transparent-mode",
			);
			if (transparentMode === "semifull") {
				if (
					typeof (window as any).initSemifullScrollDetection ===
					"function"
				) {
					(window as any).initSemifullScrollDetection();
				}
			}
		}
	}

	/**
	 * 处理 body class
	 */
	private handleBodyClass(_isHomePage: boolean): void {
		// body class 统一由 CSS 处理，无需区分首页/非首页
	}

	/**
	 * 处理 Banner 文字可见性
	 */
	private handleBannerTextVisibility(isHomePage: boolean): void {
		const bannerTextOverlay = this.getCachedElement(
			SWUP_SELECTORS.bannerTextOverlay,
		);
		if (bannerTextOverlay) {
			if (isHomePage) {
				bannerTextOverlay.classList.remove("hidden");
			} else {
				bannerTextOverlay.classList.add("hidden");
			}
		}
	}

	/**
	 * 处理 Navbar 状态
	 */
	private handleNavbarState(isHomePage: boolean): void {
		const navbar = this.getCachedElement(SWUP_SELECTORS.navbar);
		if (navbar) {
			navbar.setAttribute("data-is-home", isHomePage.toString());

			// 重新初始化 semifull 模式滚动检测
			const transparentMode = navbar.getAttribute(
				"data-transparent-mode",
			);
			if (transparentMode === "semifull") {
				if (
					typeof (window as any).initSemifullScrollDetection ===
					"function"
				) {
					(window as any).initSemifullScrollDetection();
				}
			}
		}
	}

	/**
	 * 处理移动端 Banner 可见性
	 */
	private handleMobileBannerVisibility(isHomePage: boolean): void {
		const mode = this.getCurrentWallpaperMode();
		if (mode !== "banner" && mode !== "fullscreen") {
			return;
		}

		const bannerWrapper = this.getCachedElement(
			SWUP_SELECTORS.bannerWrapper,
		);
		const mainContentWrapper = this.getCachedElement(
			".absolute.w-full.z-30",
		);

		if (bannerWrapper && mainContentWrapper) {
			if (isHomePage) {
				// 首页：延迟移除隐藏类
				setTimeout(() => {
					bannerWrapper.classList.remove("mobile-hide-banner");
				}, ANIMATION_CONFIG.mobileBannerDelay);
				setTimeout(() => {
					mainContentWrapper.classList.remove(
						"mobile-main-no-banner",
					);
				}, ANIMATION_CONFIG.mobileContentDelay);
			} else {
				// 非首页：分阶段隐藏
				bannerWrapper.classList.add("mobile-hide-banner");
				setTimeout(() => {
					mainContentWrapper.classList.add("mobile-main-no-banner");
				}, ANIMATION_CONFIG.mobileBannerDelay);
			}
		}
	}

	private getCurrentWallpaperMode():
		| "banner"
		| "fullscreen"
		| "overlay"
		| "none" {
		const body = document.body;
		if (
			body.classList.contains("enable-banner") &&
			body.classList.contains("fullscreen-banner")
		) {
			return "fullscreen";
		}
		if (body.classList.contains("enable-banner")) {
			return "banner";
		}
		if (body.classList.contains("wallpaper-transparent")) {
			return "overlay";
		}
		return "none";
	}

	private syncMainContentPosition(isHomePage: boolean): void {
		const mode = this.getCurrentWallpaperMode();
		const mainContentWrapper = this.getCachedElement(
			".absolute.w-full.z-30.pointer-events-none",
		) as HTMLElement | null;
		const bannerWrapper = this.getCachedElement(
			SWUP_SELECTORS.bannerWrapper,
		) as HTMLElement | null;
		if (!mainContentWrapper) {
			return;
		}

		const isMobile = window.innerWidth < 1280;
		mainContentWrapper.classList.remove("mobile-main-no-banner", "no-banner-layout");
		mainContentWrapper.style.removeProperty("min-height");

		if (mode === "fullscreen") {
			if (isMobile && !isHomePage) {
				bannerWrapper?.classList.add("mobile-hide-banner");
				mainContentWrapper.classList.add("mobile-main-no-banner", "no-banner-layout");
				mainContentWrapper.style.position = "";
				mainContentWrapper.style.zIndex = "";
				mainContentWrapper.style.setProperty("top", "5.5rem", "important");
				mainContentWrapper.style.setProperty("margin-top", "0", "important");
				return;
			}

			bannerWrapper?.classList.remove("mobile-hide-banner");
			mainContentWrapper.classList.add("no-banner-layout");
			mainContentWrapper.style.position = "relative";
			mainContentWrapper.style.zIndex = "30";
			mainContentWrapper.style.setProperty("top", "0", "important");
			mainContentWrapper.style.setProperty(
				"margin-top",
				isMobile ? "0" : "1rem",
				"important",
			);
			return;
		}

		mainContentWrapper.style.position = "";
		mainContentWrapper.style.zIndex = "";
		mainContentWrapper.style.setProperty("margin-top", "0", "important");

		if (mode === "banner") {
			if (isMobile && !isHomePage) {
				bannerWrapper?.classList.add("mobile-hide-banner");
				mainContentWrapper.classList.add("mobile-main-no-banner");
				mainContentWrapper.style.setProperty("top", "5.5rem", "important");
				return;
			}

			if (isMobile) {
				bannerWrapper?.classList.remove("mobile-hide-banner");
				mainContentWrapper.style.removeProperty("top");
				mainContentWrapper.style.removeProperty("min-height");
				return;
			}

			bannerWrapper?.classList.remove("mobile-hide-banner");
			mainContentWrapper.style.setProperty(
				"top",
				`${BANNER_HEIGHT}vh`,
				"important",
			);
			return;
		}

		bannerWrapper?.classList.remove("mobile-hide-banner");
		mainContentWrapper.classList.add("no-banner-layout");
		mainContentWrapper.style.setProperty("top", "5.5rem", "important");
	}

	private ensureNavbarVisibleForFullscreen(): void {
		if (this.getCurrentWallpaperMode() !== "fullscreen") {
			return;
		}
		const navbarWrapper = this.getCachedElement(
			SWUP_SELECTORS.navbarWrapper,
		) as HTMLElement | null;
		if (navbarWrapper) {
			navbarWrapper.classList.remove("navbar-hidden");
		}
	}

	private updatePageOverlay(): void {
		const overlay = document.getElementById("banner-page-overlay");
		if (!overlay) {
			return;
		}

		const dataEl = document.getElementById("page-overlay-data");
		if (!dataEl) {
			this.clearOverlay(overlay);
			return;
		}

		const isHome = dataEl.dataset.isHome === "true";
		const mode = dataEl.dataset.wallpaperMode || "";
		const isBannerMode = mode === "banner" || mode === "fullscreen";

		if (isHome || !isBannerMode) {
			this.clearOverlay(overlay);
			return;
		}

		const title = dataEl.dataset.title || "";
		if (!title) {
			this.clearOverlay(overlay);
			return;
		}

		const titleEl = document.getElementById("page-overlay-title");
		const metaEl = document.getElementById("page-overlay-meta");
		const dateEl = document.getElementById("page-overlay-date");
		const categoryEl = document.getElementById("page-overlay-category");
		const wordsEl = document.getElementById("page-overlay-words");
		if (!titleEl || !metaEl || !dateEl || !categoryEl || !wordsEl) {
			return;
		}

		titleEl.textContent = title;
		titleEl.classList.remove("anim-in");

		const isPost = dataEl.dataset.isPost === "true";
		const date = dataEl.dataset.date || "";
		const category = dataEl.dataset.category || "";
		const words = dataEl.dataset.words || "";

		if (isPost && (date || category || words)) {
			dateEl.textContent = date;
			categoryEl.textContent = category;
			wordsEl.textContent = words ? `${words} 字` : "";
			metaEl.classList.remove("hidden");
			metaEl.classList.remove("anim-in");

			overlay.style.opacity = "1";
			overlay.style.transform = "";
			overlay.style.filter = "";

			void titleEl.offsetWidth;
			titleEl.classList.add("anim-in");
			void metaEl.offsetWidth;
			metaEl.classList.add("anim-in");
		} else {
			metaEl.classList.add("hidden");
			overlay.style.opacity = "1";
			overlay.style.transform = "";
			overlay.style.filter = "";
			void titleEl.offsetWidth;
			titleEl.classList.add("anim-in");
		}
	}

	private clearOverlay(overlay: HTMLElement): void {
		const titleEl = document.getElementById("page-overlay-title");
		const metaEl = document.getElementById("page-overlay-meta");
		if (titleEl) {
			titleEl.textContent = "";
			titleEl.classList.remove("anim-in");
		}
		if (metaEl) {
			metaEl.classList.add("hidden");
			metaEl.classList.remove("anim-in");
		}
		overlay.style.opacity = "";
		overlay.style.transform = "";
		overlay.style.filter = "";
	}

	/**
	 * 扩展/隐藏页面高度
	 */
	private extendPageHeight(hide: boolean): void {
		const heightExtend = this.getCachedElement(
			SWUP_SELECTORS.pageHeightExtend,
		);
		if (!heightExtend) {
			return;
		}

		// 只在 Banner 模式下启用高度扩展
		// fullscreen/none 模式内容往往不足一屏，如果强行扩展高度，
		// 会导致滚动条在页面过渡期间闪现，引发布局左右抖动
		const isBannerMode = document.body.classList.contains("enable-banner");
		if (!isBannerMode) {
			return;
		}

		if (hide) {
			heightExtend.classList.add("hidden");
		} else {
			heightExtend.classList.remove("hidden");
		}
	}

	/**
	 * 隐藏 TOC
	 */
	private hideTOC(): void {
		const toc = this.getCachedElement(SWUP_SELECTORS.tocWrapper);
		if (toc) {
			toc.classList.add("toc-not-ready");
		}
	}

	/**
	 * 显示 TOC
	 */
	private showTOC(): void {
		const toc = this.getCachedElement(SWUP_SELECTORS.tocWrapper);
		if (toc) {
			toc.classList.remove("toc-not-ready");
		}
	}

	/**
	 * 同步主题状态
	 * 解决从首页进入文章页面时代码块渲染问题
	 */
	private syncThemeState(): void {
		const storedTheme =
			localStorage.getItem(THEME_CONFIG.themeStorageKey) ||
			THEME_CONFIG.lightMode;
		const isDark = storedTheme === THEME_CONFIG.darkMode;
		const expectedTheme = isDark
			? THEME_CONFIG.darkExpressiveTheme
			: THEME_CONFIG.lightExpressiveTheme;

		const currentTheme =
			document.documentElement.getAttribute("data-theme");
		const hasDarkClass =
			document.documentElement.classList.contains("dark");

		// 如果主题不匹配，使用批量更新减少重绘
		if (currentTheme !== expectedTheme || hasDarkClass !== isDark) {
			requestAnimationFrame(() => {
				// 同步 data-theme 属性
				if (currentTheme !== expectedTheme) {
					document.documentElement.setAttribute(
						"data-theme",
						expectedTheme,
					);
				}
				// 同步 dark class
				if (hasDarkClass !== isDark) {
					if (isDark) {
						document.documentElement.classList.add("dark");
					} else {
						document.documentElement.classList.remove("dark");
					}
				}
			});
		}
	}

	/**
	 * 触发页面加载完成事件
	 * 用于初始化评论系统
	 */
	private dispatchPageLoadedEvent(): void {
		setTimeout(() => {
			if (
				document.getElementById("tcomment") ||
				document.getElementById("giscus-container")
			) {
				const pageLoadedEvent = new CustomEvent("mizuki:page:loaded", {
					detail: {
						path: window.location.pathname,
						timestamp: Date.now(),
					},
				});
				document.dispatchEvent(pageLoadedEvent);
				console.log(
					"Layout: 触发 mizuki:page:loaded 事件，路径:",
					window.location.pathname,
				);
			}
		}, ANIMATION_CONFIG.commentInitDelay);
	}

	/**
	 * 更新处理器
	 */
	updateHandlers(handlers: Partial<SwupHookHandlers>): void {
		this.handlers = { ...this.handlers, ...handlers };
	}
}
