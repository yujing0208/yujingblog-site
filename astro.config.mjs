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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * dist 非 ASCII 路径 → Vercel routes 修复（构建后处理，不重命名产物）。
 *
 * Round 6（2026-09-28）线上探针实证的 edge 匹配模型：
 *   - routes src 按「原始 percent-encoded 请求串」字面匹配（S2 命中）；
 *   - routes dest 在文件系统查找前会被解码/规范化（S1 ASCII dest 命中；
 *     S5 编码名 dest 404 —— 指向编码名文件的 dest 永远失配）。
 *   - 因此旧「产物重命名为编码名」路线必然 404（Round 4/4b 失败的根因）。
 * 新模型：产物保留原始中文名，src 仍写编码请求串，dest 写解码原路径
 * —— dest 解码后字面命中中文名产物。页面内 href 无需改动（浏览器自动编码）。
 */
function encodeNonAsciiDistPaths() {
	return {
		name: "encode-non-ascii-dist-paths",
		hooks: {
			"astro:build:done": async ({ dir, logger }) => {
				const base = fileURLToPath(dir);
				const hasNonAscii = (s) => /[^\x00-\x7F]/.test(s);
				const encodeSegment = (name) =>
					name.replace(/[^\x00-\x7F]+/g, (m) => encodeURIComponent(m));
				const escapeRegex = (s) =>
					s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				// 记录所有含非 ASCII 段的相对路径（不重命名，产物保留原始中文名）
				const events = [];
				let kept = 0;
				const walk = (dirPath, parentRel) => {
					let entries;
					try {
						entries = fs.readdirSync(dirPath, { withFileTypes: true });
					} catch {
						return;
					}
					for (const entry of entries) {
						const rel = parentRel ? parentRel + "/" + entry.name : entry.name;
						if (entry.isDirectory()) walk(path.join(dirPath, entry.name), rel);
						if (!/[^\x00-\x7F]/.test(rel)) continue;
						events.push({ rel, isDir: entry.isDirectory() });
						kept++;
					}
				};
				walk(base, "");
				if (kept > 0) {
					// 生成 Vercel Build Output v3 路由：
					// src = 编码请求串（edge 原样匹配），dest = 解码原路径（dest 查找层会解码）。
					const routes = [];
					const overrides = {};
					for (const ev of events) {
						const encRel = ev.rel.split("/").map(encodeSegment).join("/");
						const dest = "/" + ev.rel + (ev.isDir ? "/index.html" : "");
						if (ev.isDir) {
							routes.push({ src: "^" + escapeRegex("/" + encRel + "/") + "$", dest });
							routes.push({ src: "^" + escapeRegex("/" + encRel) + "$", dest });
							routes.push({ src: "^" + escapeRegex("/" + encRel + "/") + "index\\.html$", dest });
						} else {
							routes.push({ src: "^" + escapeRegex("/" + encRel) + "$", dest });
						}
					}
				// ===== TEMP PROBE（2026-09-28 Round 6）— 根因确认后删除 =====
				// 线上探针实证：src 按编码请求串匹配（S2 命中）、dest 查找前解码（S1 命中/S5 404）。
				// 本轮修复改为「产物保留中文名 + dest 解码原路径」，探针保留作回归信号：
				//   S1  /__probe/s1  → /__probe/s1.txt   routes 生效 + ASCII dest 解析（应 200）
				//   S2  /tag/<编码假标签>/ → s2.txt      src 编码匹配回归信号（应 200）
				//   S3  /tag/<中文假标签>/ → s3.txt      src 解码匹配（预期 404，非匹配层）
				//   S5  /__probe/s5  → /tag/<编码中文>/index.html  编码 dest（预期仍 404=对照）
				//   S6  /__probe/s6  → /tag/<中文原样>/index.html  解码 dest（修复后应 200！）
				//   S4  /__probe/s4  → /tag/<中文原样>/           解码目录 dest（修复后应 200！）
				// 探针中文标签「探针标签」不在真实路由/产物中，绝不影响真实流量。
				const PROBE_TAG = "探针标签";
				const PROBE_BO = "博客折腾";
				fs.mkdirSync(path.join(base, "__probe"), { recursive: true });
				fs.writeFileSync(path.join(base, "__probe", "s1.txt"), "S1-ROUTES-FIRE-AND-DEST-RESOLVES", "utf8");
				fs.writeFileSync(path.join(base, "__probe", "s2.txt"), "S2-ENCODED-SRC-HIT", "utf8");
				fs.writeFileSync(path.join(base, "__probe", "s3.txt"), "S3-DECODED-SRC-HIT", "utf8");
				routes.push(
					{ src: "^/__probe/s1/?$", dest: "/__probe/s1.txt" },
					{ src: "^/tag/" + encodeURIComponent(PROBE_TAG) + "/$", dest: "/__probe/s2.txt" },
					{ src: "^/tag/" + PROBE_TAG + "/$", dest: "/__probe/s3.txt" },
					{ src: "^/__probe/s5/?$", dest: "/tag/" + encodeURIComponent(PROBE_BO) + "/index.html" },
					{ src: "^/__probe/s6/?$", dest: "/tag/" + PROBE_BO + "/index.html" },
					{ src: "^/__probe/s4/?$", dest: "/tag/" + PROBE_BO + "/" },
				);
				// ===== END TEMP PROBE =====
					fs.writeFileSync(
						path.join(base, "__fp-routes.json"),
						JSON.stringify({ routes, overrides }),
						"utf8",
					);
					// 诊断探针（2026-09-27 Round 4b 后 routes/overrides 线上仍 404）：
					// 把生成结果同步写一份到 dist 根的固定名文件，部署后直接
					// GET /fp-debug.json 即可确认 Actions 构建是否生成路由数据，
					// 免掉 GitHub Actions 日志无权限拿的僵局。确认根因后删除。
					fs.writeFileSync(
						path.join(base, "fp-debug.json"),
						JSON.stringify({
							generatedAt: new Date().toISOString(),
							mode: "keep-original-names+decoded-dest",
							kept,
							routeCount: routes.length,
							overrideCount: Object.keys(overrides).length,
							sampleRoutes: routes.slice(0, 3),
						}),
						"utf8",
					);
					logger.info(
						`encode-non-ascii-dist-paths: kept ${kept} non-ascii paths (no rename), generated ${routes.length} routes + ${Object.keys(overrides).length} overrides`,
					);
				}
			},
		},
	};
}

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
		encodeNonAsciiDistPaths(),
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
			// 跨布局导航保护（修复：从其他页面返回首页偶发显示异常，需手动刷新）：
			// 手账首页(PaperHomeLayout)与其他页面(MainGridLayout)的 DOM 骨架完全不同
			// （.paper-shell 三栏 vs #main-grid 网格），而 Swup 只替换 <main> 元素，
			// 跨布局换页时外层壳无法凭空生成 —— 回首页丢 hero/壳、进文章页丢侧栏网格。
			// ignore 返回 true 时 Swup 完全不接管该导航（官方行为：浏览器整页加载）。
			// 注意：此函数会被序列化进客户端脚本，必须自包含、不能引用外部变量；
			// 仅匹配站点根路径("/")为手账首页，若未来改为子路径部署需同步调整。
			ignore: (targetUrl) => {
				try {
					const path = String(targetUrl).split("#")[0].split("?")[0];
					const targetIsPaperHome = path.replace(/^\/+|\/+$/g, "") === "";
					const currentIsPaperHome =
						!!document.querySelector(".paper-shell");
					return targetIsPaperHome !== currentIsPaperHome;
				} catch {
					return false;
				}
			},
			// 注：原 resolveUrl / animateHistoryBrowsing / skipPopStateHandling
			// 三项不在 @swup/astro 1.8 支持的选项列表中（一直被静默忽略），
			// 已移除以免误导；popstate 跨布局兜底见 src/scripts/core/swup-hooks.ts。
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
