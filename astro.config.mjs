import sitemap from "@astrojs/sitemap";
import { umami } from "oddmisc";
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import svelte, { vitePreprocess } from "@astrojs/svelte";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeComponents from "rehype-components";
import rehypeExternalLinks from "rehype-external-links";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import remarkSectionize from "remark-sectionize";

import { buildIconInclude } from "./src/plugins/astro-icon-include.mjs";
import { siteConfig } from "./src/config/index.ts";
import {
	flatpaperCodeThemeDark,
	flatpaperCodeThemeLight,
} from "./src/config/flatpaperCodeTheme.ts";
import { pluginCustomCopyButton } from "./src/plugins/expressive-code/custom-copy-button.js";
import { pluginLanguageBadge } from "./src/plugins/expressive-code/language-badge.ts";
import { AdmonitionComponent } from "./src/plugins/rehype-component-admonition.mjs";
import { GithubCardComponent } from "./src/plugins/rehype-component-github-card.mjs";
import { ImageGridComponent } from "./src/plugins/rehype-component-image-grid.mjs";
import { rehypeImageWidth } from "./src/plugins/rehype-image-width.mjs";
import { rehypeMermaid } from "./src/plugins/rehype-mermaid.mjs";
import { rehypeWrapTable } from "./src/plugins/rehype-wrap-table.mjs";
import { remarkContent } from "./src/plugins/remark-content.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { rehypeFlatpaperTabs } from "./src/plugins/rehype-flatpaper-tabs.mjs";
import { remarkEscapeNumericColons } from "./src/plugins/remark-escape-numeric-colons.mjs";
import { remarkFixGithubAdmonitions } from "./src/plugins/remark-fix-github-admonitions.js";
import { remarkMermaid } from "./src/plugins/remark-mermaid.js";
import { remarkStripLeadingTitle } from "./src/plugins/remark-strip-leading-title.mjs";
import { remarkWikiLink } from "./src/plugins/remark-wiki-link.mjs";

// https://astro.build/config
export default defineConfig({
	fonts: [
		{
			name: "JetBrains Mono",
			cssVariable: "--font-jetbrains-mono",
			provider: fontProviders.fontsource(),
			styles: ["normal", "italic"],
		},
		{
			// 对齐 homulilly.com（FlatPaper 演示站）的字体方案：
			// 拉丁字符用 New Tegomin，中文回退到 --font-cjk（Noto Sans SC）。
			name: "New Tegomin",
			cssVariable: "--font-body",
			provider: fontProviders.fontsource(),
			styles: ["normal"],
			// These variables are composed into --font-sans below. Keep their
			// fallback lists empty; otherwise a system fallback after this Latin
			// font prevents the following CJK font from ever being considered.
			fallbacks: [],
			optimizedFallbacks: false,
		},
		{
			// 中文正文：Noto Sans SC（fontsource 自托管，构建期下载、按 unicode-range 子集加载）
			name: "Noto Sans SC",
			cssVariable: "--font-cjk",
			provider: fontProviders.fontsource(),
			styles: ["normal"],
			// The final system fallback belongs to --font-sans, not this partial
			// CJK font stack.
			fallbacks: [],
			optimizedFallbacks: false,
		},
		{
			// 中文手写楷书（站题/大标题用，--font-display）：与 New Tegomin 的手账气质配套
			name: "Ma Shan Zheng",
			cssVariable: "--font-hand",
			provider: fontProviders.fontsource(),
			styles: ["normal"],
			fallbacks: [],
			optimizedFallbacks: false,
		},
	],

	site: siteConfig.siteURL,
	base: "/",
	trailingSlash: "always",
	compressHTML: true,

	output: "static",

	image: {
		layout: "constrained",
	},

	server: {
		// 仅 dev 使用；3001 是刻意为之：变更此值会改变 content layer 的
		// astro-config-digest，从而清空 .astro 渲染缓存全量重渲染。
		// 2026-10-02：依赖级修复（micromark-util-character overrides）不会使渲染缓存失效，
		// 旧的字面量 ::github 渲染结果被持续复用，靠改端口强制失效一次。
		// 2026-10-02 晚：remark-fix-github-admonitions 重写同理，port 3001→3002 再失效一次。
		port: 3002,
	},

	integrations: [
		umami({
			shareUrl: 'https://cloud.umami.is/share/eq6I2iWnakVCH2Rt',
		}),
		// 2026-10-06：移除 @swup/astro 无刷新导航，改为浏览器原生整页刷新，
		// 与参考站 flatpaper.nep.me 完全一致（原站无任何 pjax/turbo/barba/swup 类库）。
		// 移除后带来的行为变化（均为期望行为）：
		//   · 每次站内跳转都是整页加载，head/body 全量重渲染，不再有过渡动画；
		//   · 不再需要跨布局守卫（原 ignore 选项）、persistTags/awaitAssets 等
		//     head 差量补丁，样式与脚本始终从零加载，天然不会有残留状态；
		//   · 首屏大图/音乐播放器在换页时会重新初始化（与参考站一致）。
		// 相关清理见 src/layouts/Layout.astro（已删除 initSwupManager 入口）、
		// src/scripts/swup-manager.ts 及其 hooks（文件保留但不再被引用）。
		icon({
			include: {
			    ...buildIconInclude(),
		        logos: ['*'],
		        gg: ['vercel'],
		    },
		}),
		expressiveCode({
			// 代码块配色改为 FlatPaper 演示站 `code.theme: simple` 的语义令牌映射，
			// 主题由 src/config/flatpaperCodeTheme.ts 提供（亮/暗各一套真值）
			themes: [flatpaperCodeThemeLight, flatpaperCodeThemeDark],
			// 关掉对比度自动校正，否则橙色/蓝色 token 会被 EC 改亮度，与演示站对不上
			minSyntaxHighlightingColorContrast: 0,
			plugins: [
				pluginCollapsibleSections(),
				pluginLineNumbers(),
				pluginLanguageBadge(),
				pluginCustomCopyButton(),
			],
			defaultProps: {
				wrap: true,
				overridesByLang: {
					shellsession: { showLineNumbers: false },
					bash: { frame: "code" },
					shell: { frame: "code" },
					sh: { frame: "code" },
					zsh: { frame: "code" },
				},
			},
			styleOverrides: {
				codeBackground: "var(--codeblock-bg)",
				borderRadius: "0.75rem",
				borderColor: "none",
				codeFontSize: "0.875rem",
				codeFontFamily:
					"var(--font-jetbrains-mono), SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
				codeLineHeight: "1.5rem",
				frames: {
					editorBackground: "var(--codeblock-bg)",
					terminalBackground: "var(--codeblock-bg)",
					terminalTitlebarBackground: "var(--codeblock-bg)",
					editorTabBarBackground: "var(--codeblock-bg)",
					editorActiveTabBackground: "none",
					editorActiveTabIndicatorBottomColor: "var(--primary)",
					editorActiveTabIndicatorTopColor: "none",
					editorTabBarBorderBottomColor: "var(--codeblock-bg)",
					terminalTitlebarBorderBottomColor: "none",
				},
				textMarkers: {
					delHue: 0,
					insHue: 180,
					markHue: 250,
				},
			},
			frames: {
				showCopyToClipboardButton: false,
			},
		}),
		svelte({
			preprocess: vitePreprocess(),
		}),
		sitemap(),
		mdx(),
	],
	markdown: {
		processor: unified({
			remarkPlugins: [
				// 必须最先跑：在 sectionize / directive 改造 AST 之前，
				// 把正文开头的 `# 标题` 摘掉（避免与文章头 H1 重复）
				remarkStripLeadingTitle,
				remarkMath,
				remarkContent,
				remarkFixGithubAdmonitions,
				remarkDirective,
				remarkEscapeNumericColons,
				remarkSectionize,
				parseDirectiveNode,
				remarkMermaid,
				remarkWikiLink,
			],
			rehypePlugins: [
				rehypeKatex,
				[
					rehypeExternalLinks,
					{
						target: "_blank",
						rel: ["nofollow", "noopener", "noreferrer"],
					},
				],
				rehypeSlug,
				rehypeWrapTable,
				rehypeFlatpaperTabs,
				rehypeMermaid,
				[
					rehypeComponents,
					{
						components: {
							github: GithubCardComponent,
							grid: ImageGridComponent,
							// FlatPaper 演示站的 6 种 note 变体 + 兼容别名
							note: (x, y) => AdmonitionComponent(x, y, "note"),
							primary: (x, y) => AdmonitionComponent(x, y, "primary"),
							info: (x, y) => AdmonitionComponent(x, y, "info"),
							success: (x, y) => AdmonitionComponent(x, y, "success"),
							danger: (x, y) => AdmonitionComponent(x, y, "danger"),
							error: (x, y) => AdmonitionComponent(x, y, "danger"),
							tip: (x, y) => AdmonitionComponent(x, y, "tip"),
							important: (x, y) =>
								AdmonitionComponent(x, y, "important"),
							caution: (x, y) => AdmonitionComponent(x, y, "caution"),
							warning: (x, y) => AdmonitionComponent(x, y, "warning"),
						},
					},
				],
				[
					rehypeAutolinkHeadings,
					{
						behavior: "append",
						properties: {
							className: ["anchor"],
						},
						content: {
							type: "element",
							tagName: "span",
							properties: {
								className: ["anchor-icon"],
								"data-pagefind-ignore": true,
							},
							children: [{ type: "text", value: "#" }],
						},
					},
				],
				rehypeImageWidth,
			],
		}),
	},
	vite: {
		plugins: [tailwindcss()],
		// 开发环境预打包优化：将常用依赖提前编译，避免首次页面加载时 on-demand 编译导致 8s+ 的等待
		optimizeDeps: {
			include: [
				"@iconify/svelte",
				"svelte",
				"svelte/transition",
				"svelte/easing",
				"overlayscrollbars",
				"@fancyapps/ui",
				"marked",
				"sanitize-html",
				"qrcode",
			],
		},
		// 预热常用入���文件，让 Vite 在服务器启动后立即开始转换，而不是等到浏览器请求
		server: {
			warmup: {
				clientFiles: [
					"src/layouts/Layout.astro",
					"src/pages/index.astro",
					"src/components/widgets/music-player/MusicPlayer.svelte",
					"src/components/organisms/navigation/Search.svelte",
					"src/components/control/ThemeSwitch.svelte",
					"src/components/features/settings/DisplaySettings.svelte",
				],
			},
		},
		build: {
			// 静态资源处理优化，防止小图片转 base64 导致 HTML 体积过大
			assetsInlineLimit: 4096,
			// CSS 代码分割：关闭，将全站样式合并为单个 CSS 文件。
			// 原来每页 19 个独立 CSS 请求，串行排队导致加载/切换长时间转圈；
			// 合并后每页只请求 1 个 CSS（约 50KB 压缩后），加载速度大幅提升。
			cssCodeSplit: false,
			cssMinify: "esbuild",
			// 内联小型 CSS 文件以减少网络请求
			inlineStylesheets: "auto",
			// 生产环境移除 console 和 debugger
			minify: "esbuild",
			rollupOptions: {
				onwarn(warning, warn) {
					if (
						warning.message.includes(
							"is dynamically imported by",
						) &&
						warning.message.includes(
							"but also statically imported by",
						)
					) {
						return;
					}
					warn(warning);
				},
			},
		},
		// 生产环境移除 console.log 和 debugger
		esbuildOptions: {
			drop:
				process.env.NODE_ENV === "production"
					? ["console", "debugger"]
					: [],
		},
	},
})
