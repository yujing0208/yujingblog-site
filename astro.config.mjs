import sitemap from "@astrojs/sitemap";
import { umami } from "oddmisc";
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import svelte, { vitePreprocess } from "@astrojs/svelte";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import swup from "@swup/astro";
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
import { remarkEscapeNumericColons } from "./src/plugins/remark-escape-numeric-colons.mjs";
import { remarkFixGithubAdmonitions } from "./src/plugins/remark-fix-github-admonitions.js";
import { remarkMermaid } from "./src/plugins/remark-mermaid.js";
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
			name: "ZenMaruGothic-Medium",
			cssVariable: "--font-body",
			provider: fontProviders.local(),
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/ZenMaruGothic-Medium.ttf"],
						weight: "500",
						style: "normal",
					},
				],
			},
			// These variables are composed into --font-sans below. Keep their
			// fallback lists empty; otherwise a system fallback after this Latin
			// font prevents the following CJK font from ever being considered.
			fallbacks: [],
			optimizedFallbacks: false,
		},
		{
			name: "Loli",
			cssVariable: "--font-cjk",
			provider: fontProviders.local(),
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/loli.ttf"],
						weight: "400",
						style: "normal",
					},
				],
			},
			// The final system fallback belongs to --font-sans, not this partial
			// CJK font stack.
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
		port: 3000,
	},

	integrations: [
		umami({
			shareUrl: 'https://cloud.umami.is/share/eq6I2iWnakVCH2Rt',
		}),
		swup({
			theme: false,
			animationClass: "transition-swup-",
			containers: ["main"],
			smoothScrolling: false, // 禁用平滑滚动以提升性能，避免与锚点导航冲突
			cache: true,
			// 开启悬停预取：鼠标悬停链接即预载整页 HTML，点击时近乎瞬时。
			// 原 preload:false 实为每次点击冷请求整页文档，反而更慢。
			preload: true,
			accessibility: true,
			// 修复站内切换 CSS 丢失：对象形式让 Swup 等待新页样式表加载完成再换内容，
			// 并把共享 CSS 标记为常驻（不反复移除/重加），消除 head 差量竞态。
			// persistTags:true 保留所有既有 head 标签（含内联 <style>），仅新增缺失项，
			// 从机制上杜绝切换后样式/导航条丢失（刷新才恢复）的问题。
			// 仅生产环境开启 head 更新（与原有 NODE_ENV 门控保持一致）。
			updateHead:
				process.env.NODE_ENV === "production"
					? { awaitAssets: true, persistAssets: true, persistTags: true }
					: false,
			updateBodyClass: false,
			globalInstance: true,
			// 滚动相关配置优化
			resolveUrl: (url) => url,
			animateHistoryBrowsing: false,
			skipPopStateHandling: (event) => {
				// 跳过锚点链接的处理，让浏览器原生处理
				return (
					event.state &&
					event.state.url &&
					event.state.url.includes("#")
				);
			},
		}),
		icon({
			include: {
			    ...buildIconInclude(),
		        logos: ['*'],
		        gg: ['vercel'],
		    },
		}),
		expressiveCode({
			themes: ["github-light", "github-dark"],
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
				rehypeMermaid,
				[
					rehypeComponents,
					{
						components: {
							github: GithubCardComponent,
							grid: ImageGridComponent,
							note: (x, y) => AdmonitionComponent(x, y, "note"),
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
		// 预热常用入口文件，让 Vite 在服务器启动后立即开始转换，而不是等到浏览器请求
		server: {
			warmup: {
				clientFiles: [
					"src/layouts/Layout.astro",
					"src/pages/index.astro",
					"src/components/widgets/music-player/MusicPlayer.svelte",
					"src/components/organisms/navigation/Search.svelte",
					"src/components/control/ThemeSwitch.svelte",
					"src/components/features/settings/DisplaySettings.svelte",
					"src/scripts/swup-manager.ts",
				],
			},
		},
		build: {
			// 静态资源处理优化，防止小图片转 base64 导致 HTML 体积过大
			assetsInlineLimit: 4096,
			// CSS 代码分割：关闭，将全站样式合并为单个 CSS 文件。
			// 原来每页 19 个独立 CSS 请求，串行排队导致加载/切换长时间转圈；
			// 合并后每页只请求 1 个 CSS（约 50KB 压缩后），切换时样式全在浏览器缓存，
			// 加载与站内切换速度大幅提升，且 Swup persistAssets 对单一共享 CSS 保护更彻底。
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
