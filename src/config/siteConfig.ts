import type { SiteConfig } from "../types/config";
import { deepMerge } from "./_settings";
// ↓ 内容仓 content/settings/site.ts，经 junction 落到 src/settings/site.ts。
//   和 announcementConfig.ts 引 ../data/announcement 是同一种写法，线上已实证。
import editable from "../settings/site";
// 首屏（PaperHero）的可编辑数据来自 content/settings/hero.ts（编辑器「首屏」tab）。
// 此前 siteConfig 只从 site.ts 取 paperHero，导致「首屏」tab 的改动不生效；
// 现在把 hero.ts 合并进 paperHero，让编辑器真正控制首屏。
import heroEditable from "../settings/hero";

// ══════════════════════════════════════════════════════════════════════
// 站点语言（构建期常量，不可编辑）
// ══════════════════════════════════════════════════════════════════════
const SITE_LANG = "zh_CN";

// ══════════════════════════════════════════════════════════════════════
// L1 写死的常量区
//
// 这些曾经是 siteConfig 里的「开关」，现在不再是开关，而是这个主题的事实。
// 它们不出现在内容仓的可编辑文件里，但依然要出现在最终的 siteConfig 中，
// 因为引用方还在读（例如 image-utils.ts 读 imageOptimization）。
// ══════════════════════════════════════════════════════════════════════
const HARDCODED = {
	lang: SITE_LANG,

	// ── 页面缩放：全站关闭 ──────────────────────────────────────────
	// 内页原本按 clientWidth/2000（下限 0.85）把 html 字号压到 85%，
	// --page-width(81.25rem) 跟着缩成 1105px；而手账首页 body.paper-layout
	// 会跳过缩放，导航就变成「首页 1300px / 内页 1105px」两种尺寸。
	// 参考站 FlatPaper 也没有整页缩放（固定 min(94%,1300px) 容器），
	// 关掉后所有页面的导航与内容宽度、字号完全一致。
	pageScaling: { enable: false, targetWidth: 2000 },

	homeLayout: "paper" as const,

	// ── 目录 TOC ────────────────────────────────────────────────────
	// desktopSidebar 已删除右侧悬浮目录（目录在左栏 card-toc）
	toc: {
		enable: true,
		mobileTop: true,
		floating: true,
		depth: 2 as const,
		useJapaneseBadge: true,
	},

	// ── 标签样式 ────────────────────────────────────────────────────
	tagStyle: { useNewStyle: false },

	showCoverInContent: true,
	generateOgImages: false,
	showLastModified: true,

	pageProgressBar: { enable: true, height: 3, duration: 6000 },

	card: { border: true, followTheme: false },

	favicon: [
		{ src: "/favicon/avatar-icon.png", theme: "light" as const, sizes: "64x64" },
		{ src: "/favicon/avatar-icon.png", theme: "dark" as const, sizes: "64x64" },
	],

	// 第三方统计（Microsoft Clarity）保持关闭 —— 启用会拉低 Lighthouse 评分
	thirdPartyAnalytics: { enable: false, clarityId: "" },

	// ── 壁纸模式 ────────────────────────────────────────────────────
	// 首屏已改为手账风 PaperHero，壁纸模式保持 none。
	// banner 相关配置整块已删除（Banner.astro / FullscreenWallpaper 一并未启用）。
	wallpaperMode: { defaultMode: "none" as const, showModeSwitchOnMobile: "both" as const },

	// ── 番剧 / 日记数据源（均走本地静态数据，未接外部 API）────────
	anime: { mode: "local" as const },
	bangumi: { userId: "your-bangumi-id", fetchOnDev: false },
	bilibili: {
		vmid: "your-bilibili-vmid",
		fetchOnDev: false,
		coverMirror: "",
		useWebp: true,
	},
	diaryApiUrl: "",

	// ── 文章列表 ────────────────────────────────────────────────────
	postListLayout: {
		defaultMode: "list" as const,
		enable: true,
		allowSwitch: true,
		categoryBar: { enable: true },
	},

	// ── 特色页面开关 ────────────────────────────────────────────────
	// 关闭未使用的页面有助于提升 SEO。改动这里需要同步改 navbar.ts（L3）。
	// 注意：这些开关决定路由是否存在，属构建期结构，不开放给编辑器。
	featurePages: {
		anime: true,
		diary: true,
		friends: true,
		projects: true,
		skills: true,
		timeline: true,
		albums: true,
		devices: true,
		aiTools: false,
		changelog: true,
		notebooks: true,
	},

	// ── 图片优化 ────────────────────────────────────────────────────
	imageOptimization: {
		formats: "webp" as const,
		quality: 85,
		// 需要添加 referrerpolicy="no-referrer" 的域名（支持通配符）
		noReferrerDomains: ["*.hdslb.com"],
	},

	// ── 壁纸模式已关，但 wallpaperMode 之外的 banner 字段全部删除 ──
	// SiteConfig 类型里 banner 是必填，这里补一个最小占位，
	// 保证 homeLayout === "paper" 时不会有任何代码去读它。
	banner: {
		src: { desktop: [] as string[], mobile: [] as string[] },
		position: "center" as const,
		carousel: { enable: false, interval: 3, switchable: false },
		waves: { enable: false, performanceMode: false, mobileDisable: false, switchable: false },
		imageApi: { enable: false, url: "" },
		homeText: {
			enable: false,
			title: "",
			subtitle: [] as string[],
			typewriter: { enable: false, speed: 100, deleteSpeed: 50, pauseTime: 2000 },
			switchable: false,
		},
		credit: { enable: false, text: "", url: "" },
		navbar: { transparentMode: "semifull" as const },
	},
};

// ══════════════════════════════════════════════════════════════════════
// L3 可编辑区的回落默认值
//
// 内容仓 content/settings/site.ts 缺字段时用这里的值。
// 缺整个文件才会让构建失败 —— 这是刻意的：宁可编译期报错，
// 也不要静默产出一个配置残缺的站点。
// ══════════════════════════════════════════════════════════════════════
const EDITABLE_DEFAULT = {
	title: "YuJing的记忆终端",
	subtitle: "记一些无用的日常，和有光的时刻。",
	siteURL: "https://yujingblog.top/",
	siteStartDate: "2026-07-25",

	// 主题色相。fixed 不再是开关（色相选择器始终对访问者可见）
	themeColor: { hue: 240, fixed: false },

	// 顶栏标题
	navbarTitle: {
		mode: "text-icon" as const,
		text: "Yujing",
		icon: "assets/home/avatar.webp",
		logo: "assets/home/default-logo.webp",
	},

	// 手账首屏（homeLayout: "paper" 时生效）
	paperHero: {
		enable: true,
		images: ["/assets/banner/city-sunset.jpg"] as string[],
		mobileImage: true,
		imageOverlay: [0.2, 0.2] as [number, number],
		noteText: "欢迎访问",
		stickers: [
			{ image: "/images/stickers/claudecode.webp", size: 100 },
			{ image: "/images/stickers/madoka.webp", size: 100 },
			{ image: "/images/stickers/homura.webp", size: 100 },
		],
		stickersDraggable: true,
		ctaText: "开始阅读",
		// 首屏个签下方的快捷链接行（文字链接，区别于右下角社交书签图标条）。
		// 内容仓缺 links 时回落到这里的默认值（与「首屏」tab 初始数据一致）。
		links: [
			{ name: "个人主页", url: "https://home.yujingblog.top/" },
			{ name: "朋友圈", url: "https://www.yujingblog.top/circle/" },
			{ name: "留言板", url: "https://yujingblog.top/guestbook/" },
			{ name: "便签墙", url: "https://notes.yujingblog.top/" },
			{ name: "音乐", url: "https://yujingblog.top/music/" },
		],
	},
};

/** 从内容仓 content/settings/site.ts 取值的部分 */
const editableMerged = deepMerge(EDITABLE_DEFAULT, editable);

// 首屏（PaperHero）的可编辑数据来自 content/settings/hero.ts（编辑器「首屏」tab）。
// 与写死的默认值合并：内容仓缺字段时回落到 EDITABLE_DEFAULT.paperHero。
const paperHeroConfig = deepMerge(EDITABLE_DEFAULT.paperHero, heroEditable);

/**
 * 站点核心配置。
 *
 * ⚠️ 结构契约：导出的名字（siteConfig）和类型（SiteConfig）都不能变 ——
 *    index.ts 是纯 re-export，64 个引用方走它；
 *    另有 src/utils/image-utils.ts 直连本文件读 imageOptimization。
 */
export const siteConfig: SiteConfig = {
	...HARDCODED,
	...editableMerged,
	// paperHero 由 hero.ts（编辑器「首屏」tab）驱动，见上方 paperHeroConfig
	paperHero: paperHeroConfig,
	// banner 与 toc 等嵌套对象需要单独合并一次，避免被 editable 的浅覆盖打散
	banner: HARDCODED.banner,
	toc: HARDCODED.toc,
} as SiteConfig;

export { SITE_LANG };
