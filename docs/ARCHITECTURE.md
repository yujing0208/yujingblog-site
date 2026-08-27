# yujingblog-site 架构文档

> 本文件为**面向 AI Agent / 开发者的仓库深度说明**。目标是让任何阅读者在 10 分钟内理解博客的工作原理、代码组织与数据流，从而安全地修改或扩展功能。
>
> 最后更新：2026-08-27（基于仓库 `src/` 实际代码核对）

---

## 1. 项目概览

`yujingblog-site-main` 是 **余京的个人博客**，基于开源 Astro 主题 **Mizuki（v9）** 深度定制，现已独立演进为 `yujingblog` 品牌。

核心定位：

- **纯静态站点**（`output: "static"`），构建产物为 `dist/`，部署到 **Vercel**。
- **内容与代码分离**：文章/数据保存在独立的内容仓库（`yujingblog-content`），通过 `sync-content.js` 在构建前同步到本地。
- **SPA 式体验**：使用 **Swup** 实现站内无刷新切换。
- **强交互组件**：Live2D 看板娘（可 AI 聊天）、留言板（Twikoo）、音乐播放器 + 3D 可视化、微信朋友圈风格日记等。

### 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | **Astro 7**（SSG + Islands） |
| UI 交互组件 | **Svelte 5**（`client:only` 水合） |
| 样式 | **Tailwind CSS v4**（`@tailwindcss/vite`）+ 自定义 CSS 变量 |
| 站内切换 | **Swup**（`@swup/astro`，PWA 式无刷新） |
| Markdown | `@astrojs/markdown-remark` + 自定义 remark/rehype 插件链 |
| 代码高亮 | **Expressive Code**（自定义插件） |
| 搜索 | **Pagefind**（构建后索引静态站） |
| 评论/留言 | **Twikoo**（私有部署，REST 直连） |
| 图标 | **astro-icon**（白名单打包） |
| 代码规范 | **Biome**（lint + format） |
| 包管理 | **pnpm**（`only-allow pnpm` 强制） |

---

## 2. 目录结构（顶层）

```
yujingblog-site-main/
├── api/                  # Vercel Serverless Function（DeepSeek 聊天代理）
├── content/              # 内容仓库同步的落地目录（posts/spec/data/images）
├── docs/                 # 项目文档（本文档、开发规范、部署指南）
├── public/               # 静态资源：/js（编辑器、页面脚本）、/pio（看板娘）、/images（相册）
├── scripts/              # 构建/内容脚本（同步、番剧、AI 摘要、新建文章…）
├── src/                  # 全部源码（见下）
│   ├── assets/           # 字体、静态图
│   ├── components/       # 组件（atoms/organisms/widgets/features/control）
│   ├── config/           # 站点配置（23 个配置文件）
│   ├── constants/        # 全局常量（分页大小、壁纸模式等）
│   ├── content/          # 文章内容（构建时由 sync 填充）
│   ├── data/             # 结构化数据（友链、番剧、时间线、项目、日记…）
│   ├── i18n/             # 多语言（中/英/日/繁）文案系统
│   ├── layouts/          # Layout / MainGridLayout / partials
│   ├── pages/            # 路由页面（Astro + API 端点）
│   ├── plugins/          # Markdown remark/rehype 插件（16 个）
│   ├── scripts/          # 前端交互脚本（swup 管理、面板、主题…）
│   ├── stores/           # Svelte 全局 store（音乐播放器、留言板）
│   ├── styles/           # 全局/分页 CSS（Tailwind 入口 main.css）
│   ├── types/            # 全量 TS 类型定义
│   └── utils/            # 工具函数（URL、排序、面板、日期…）
├── astro.config.mjs      # Astro 主配置（构建、插件、Markdown 管线）
├── biome.json            # 代码规范
├── pagefind.yml          # 搜索索引配置
├── svelte.config.js      # Svelte 编译配置
├── tsconfig.json         # TS 路径别名（@/ @components/ @utils/ 等）
└── vercel.json           # Vercel 部署/缓存/安全头
```

---

## 3. 内容与配置分离架构

**核心机制**：文章正文与站点配置分开维护。

```
内容仓库 (GitHub: yujingblog-content)
   │  含 content/posts/*.md、src/data/*.ts、public/images/
   ▼
scripts/sync-content.js   ← 构建前（prebuild）自动执行
   │  ENABLE_CONTENT_SYNC / CONTENT_REPO_URL（.env 配置）
   │  git fetch + reset --hard 拉取最新内容
   ▼
本项目：
  content/        ← 内容仓库的 posts/spec/data/images 被复制或 junction 链接
  src/content/    ← 构建时内容集合读取目录
  src/data/       ← 结构数据（友链/番剧/时间线…）
```

- 本地开发时 `npm run dev` 前自动同步（`predev`）。
- CI/本地构建前 `npm run build` 也会同步（`prebuild`）。
- **注意**：sync 会 `git add -A && git commit` 记录同步来源，所以每次构建可能自动产生一次 sync 提交。

---

## 4. 配置系统（`src/config/`）

### 入口与数据流

```
src/types/config.ts  (全部配置的 TS 接口)
   ↓
src/config/*.ts      (具体配置值：siteConfig/navBarConfig/pioConfig/…)
   ↓
src/config/index.ts  (聚合 re-export)
   ↓
组件 import { siteConfig, navBarConfig } from "@/config"
```

### 核心配置文件职责

| 文件 | 导出 | 职责 |
|---|---|---|
| `siteConfig.ts` | `siteConfig`, `SITE_LANG` | 站点核心配置：标题/URL/语言、主题色、特色页开关、banner、目录、壁纸模式、统计等 |
| `navBarConfig.ts` | `navBarConfig` | 导航栏菜单（多级下拉，`children` 可为 `LinkPreset` 枚举） |
| `pioConfig.ts` | `pioConfig` | 看板娘：模型、位置、对话、菜单、气泡 |
| `sidebarConfig.ts` | `sidebarLayoutConfig` | 三栏侧边栏布局（组件分配、响应式断点） |
| `permalinkConfig.ts` | `permalinkConfig` | 固定链接模板（当前关闭，默认 `/posts/:slug/`） |
| `commentConfig.ts` | `commentConfig` | 评论：Twikoo（envId）等 |
| `musicConfig.ts` | `musicConfig` | 音乐播放器 |
| `profileConfig.ts` | `profileConfig` | 博主资料 |
| `licenseConfig.ts` | `licenseConfig` | 文章版权（CC 协议） |
| `backgroundWallpaper.ts` | — | 全屏壁纸 |
| `effectsConfig.ts` | `sakuraConfig` 等 | 樱花特效 |
| `relatedPostsConfig.ts` / `randomPostsConfig.ts` | — | 文章推荐 |
| `booknavConfig.ts` | `booknavConfig` | 网址导航页 |
| `announcementConfig.ts` | `announcementConfig` | 公告轮播 |
| `changelog.ts` | `changelogData` | 更新日志 |
| `shuoShuoProfile.ts` | `shuoShuoProfile` | 日记（说说）博主信息 |

### 关键枚举

- **`LinkPreset`**（`src/constants/link-presets.ts`）：导航预置项（Home/Archive/About/Friends/Anime/Diary/…），映射为 i18n 化的 `NavBarLink`。
- **`WidgetComponentType`**：侧边栏组件类型（profile/announcement/categories/tags/toc/music-player/pio/site-stats/…）。

---

## 5. 内容集合与数据流

### `src/content.config.ts`

- **职责**：定义内容集合 schema，并用 **`z.preprocess` 容错归一化**——内容仓库的脏 frontmatter（漏字段、类型不规范）在入库前强制转正，保证单篇坏数据不拖垮构建。
- 归一化工具：`toStr/toStrOpt/toArr/toBool/toNum`、`toDateRequired`。
- 两个集合：
  - `posts`：`src/content/posts/**/*.{md,mdx}`，字段含 title/published/description/aiSummary/image/tags/category/draft/pinned/encrypted/alias/permalink 等，`.loose()` 允许额外字段。
  - `spec`：`src/content/spec`，全宽松（用于 about 等单页）。

### 文章数据流

```
src/content/posts/*.md
   ↓ astro:content getCollection("posts")
src/utils/content-utils.ts
   ↓ getSortedPosts()（置顶 → priority → 日期排序，填充 prev/next）
路由 getStaticPaths
   ↓
静态 HTML 页面
```

- **slug 映射**：`posts/[...slug].astro` 用 `removeFileExtension(entry.id)` 得 slug，URL 为 `/posts/:slug/`；`alias` 字段额外生成别名路径；自定义 `permalink` 或 `permalinkConfig.enable` 时由 `[...permalink].astro` 生成根目录链接。

---

## 6. 路由体系（`src/pages/`）

| 文件 | 路由 | 功能 |
|---|---|---|
| `[...page].astro` | `/` `/page/N` | 首页 + 分页（`paginate`） |
| `posts/[...slug].astro` | `/posts/:slug` | 文章详情 |
| `[...permalink].astro` | `/:permalink/` | 根目录固定链接文章 |
| `archive.astro` | `/archive/` | 归档 |
| `projects.astro` | `/projects/` | 项目 |
| `friends.astro` | `/friends/` | 友链 |
| `albums.astro` + `albums/[id]` | `/albums/` | 相册（扫描 `public/images/albums`） |
| `diary.astro` | `/diary/` | 日记/说说 |
| `about.astro` | `/about/` | 关于（spec 集合渲染） |
| `anime.astro` | `/anime/` | 番剧 |
| `skills/timeline/devices/footprint/websites/changelog/guestbook.astro` | 对应路由 | 各特色页 |
| `music/index.astro` | `/music/` | 音乐可视化 |
| `admin/[page].astro` | `/admin/:page-edit` | 可视化编辑器壳 |
| `rss.xml.ts` `atom.xml.ts` | `/rss.xml` `/atom.xml` | Feed |
| `robots.txt.ts` | `/robots.txt` | 爬虫规则 |
| `og/[...slug].ts` | `/og/:slug.png` | OG 图片（satori + sharp） |
| `api/allPostMeta.json.ts` 等 | `/api/*.json` | 搜索/日历数据 |

---

## 7. 布局体系

```
所有内容页 → MainGridLayout.astro → Layout.astro
音乐页    → 直接用 Layout.astro（无侧边栏）
```

- **`Layout.astro`**（根布局）：`<head>`（SEO/OG/字体/全局 CSS）、Umami 统计、全局 CSS 变量、`ConfigCarrier`、`PageProgressBar`、常驻组件（MusicPlayer、GuestbookWidget、Pio 看板娘）、初始化 Swup。
- **`MainGridLayout.astro`**：页面骨架——Navbar + Banner + 三栏 Grid（左 SideBar + 主内容 + 右 RightSideBar）+ TOC + FloatingControls + Footer。用 `grid-layout-utils.ts` 计算响应式网格类名。
- **partials/**：`HeadTags`（SEO）、`AnalyticsScripts`（统计）、`GridScripts`（运行时配置变量注入）。

---

## 8. 组件分层（`src/components/`）

采用「原子设计 + 领域聚合」混合模式，`.astro`（SSR/轻交互）+ `.svelte`（复杂水合）混用。

| 层级 | 说明 | 代表 |
|---|---|---|
| `atoms/` | 基础 UI | Button/Icon/Link/Image/Badge/Chip/TypewriterText |
| `organisms/` | 页面骨架 | `navigation/Navbar.astro`、`navigation/Search.svelte`、`footer/Footer.astro` |
| `widgets/` | 侧边栏小部件 | profile/announcement/calendar/tags/categories/toc/music-player/guestbook/site-stats |
| `features/` | 业务功能 | posts/anime/albums/settings/diary/pio/music-visualizer/friends/timeline |
| `control/` | 全局控制按钮 | ThemeSwitch/LayoutSwitch/FloatingControls/BackToTop/GuestbookFabButton |

### 导航系统协作

```
Navbar.astro
 ├─ DropdownMenu.astro（桌面下拉）
 ├─ Search.svelte（Pagefind 搜索）
 ├─ ThemeSwitch / SettingsPanel / NavMenuPanel（移动端菜单）
 └─ #display-settings-switch → SettingsPanel 开合（panel-handler.ts）
```

### 设置面板（SettingsPanel.svelte）

- 面板内：主题色滑块、壁纸模式、特效、横幅、布局切换。
- 数据读写：`@utils/setting-utils.ts`（`getHue/setHue/setWallpaperMode`…），状态存 localStorage。
- **编辑入口**：面板底部「进入编辑页面」按钮 → `window.EditorLogin.start()`（打开 GitHub PAT 登录 → `/admin/:page-edit` 可视化编辑器）。

---

## 9. Markdown 渲染管线（`src/plugins/`）

通过 `astro.config.mjs` 的 `markdown.processor` 串联：**remark（mdast）→ rehype（hast）→ HTML**。

### Remark 阶段

| 插件 | 作用 |
|---|---|
| `remark-math` | 数学公式（配合 rehype-katex） |
| `remark-content` | 提取摘要/阅读时长/字数（`<!-- more -->` 分隔、CJK 计数） |
| `remark-fix-github-admonitions` | `> [!NOTE]` GitHub 告警 → admonition 指令 |
| `remark-directive` | 指令语法（`:::note` 等） |
| `remark-escape-numeric-colons` | 转义 `3:4` 数字冒号防误判指令 |
| `remark-sectionize` | 段落分节 |
| `parseDirectiveNode` | 指令 → hast 元素 |
| `remark-mermaid` | mermaid 代码块标记 |
| **`remark-wiki-link`** | **Obsidian `[[slug]]` 语法**：单独成段渲染文章卡片；行内渲染内部链接；支持 `[[slug|别名]]`、`[[slug#标题]]`、`[[#标题]]`；扫描 `src/content/posts` 建索引 |

### Rehype 阶段

| 插件 | 作用 |
|---|---|
| `rehype-katex` | 公式渲染 |
| `rehype-external-links` | 外链 `_blank` + `rel=nofollow noopener` |
| `rehype-slug` + `rehype-autolink-headings` | 标题锚点 + `#` 链接 |
| `rehype-wrap-table` | 表格外包滚动容器 |
| `rehype-mermaid` | mermaid 客户端渲染容器 |
| `rehype-components` | `::github` 卡片、`:::grid` 图片网格、`note/tip/warning…` 提示框 |
| `rehype-image-width` | `alt` 中的 `w-60%` 宽度语法 |
| Expressive Code | 代码高亮（自定义复制按钮、语言徽标插件） |

---

## 10. 前端交互（Swup 与全局脚本）

### Swup（SPA 切换）

`Layout.astro` 初始化 `src/scripts/core/swup-config.ts`：

- 容器：`main`，缓存 + 悬停预取，禁用平滑滚动避免锚点冲突。
- 生产环境 `updateHead` 用 `persistTags/persistAssets` 防止切换后样式丢失。
- **重要**：所有全局脚本必须适配 Swup 的 `content:replace` / `page:view` 事件（否则切换页面后脚本不重绑）。

### 全局状态（`src/stores/`）

- `musicPlayerStore.ts`：音乐播放器状态机（播放列表、进度、音量、歌词、localStorage 恢复）。
- `guestbookWidgetStore.ts`：留言板抽屉开合状态。

### 交互脚本（`src/scripts/`）

- `swup-manager.ts`：Swup 实例管理。
- `panel-handler.ts`：浮层面板（设置、菜单）开合与点击外部关闭。
- `swup-hooks.ts`：`syncThemeState` 等主题/布局在页面切换时同步。
- `src/utils/panel-manager.ts`：面板逻辑。

---

## 11. 特色功能模块

### 看板娘 Live2D（`features/pio/Pio.astro`）

- 构建期生成 `widgetConfig` 注入 `<iframe src="/pio/live2d-host.html">`。
- 父页面 ↔ iframe 用 `postMessage` 通信（`l2d-init` / `l2d-loaded` / `l2d-action`）。
- 菜单动作映射：`home`（回首页）、`scrollToTop`、`chat`（AI 聊天）。
- AI 聊天：`/pio/waifu-chat.js` 的 `MizukiChat`，人设 `/pio/waifu-chat.json`，后端 `api/chat.js`（Vercel Function → DeepSeek）。

### 留言板（`widgets/guestbook/`）

- Svelte 组件树 + `guestbookWidgetStore` 控制抽屉。
- **不走官方 SDK**：`lib/twikooClient.ts` 直接 POST Twikoo 私有部署 REST API（`COMMENT_GET/SUBMIT/LIKE/DELETE/GET_TICKET/COMMENT_UPDATE`）。
- 站长登录：`GET_TICKET` 获取 ticket → 编辑/删除评论。

### 音乐播放器 + 3D 可视化

- `widgets/music-player/`：完整播放器（封面旋转、播放列表、快捷键、进度）。
- `features/music-visualizer/`：**Web Audio API** 单例分析器（`AudioAnalyzer.ts`）驱动 THREE.js 3D 场景（`ThreeScene.svelte`），音频图常驻不随页面销毁。

### 日记（`features/diary/`）

- `MomentCard.astro`：微信朋友圈风格卡片，图片九宫格（`imgMode` 控制布局）、视频、置顶、Twikoo 评论。

---

## 12. 构建与部署

### 构建命令

```bash
pnpm install          # 安装（pnpm 强制）
npm run sync-content  # 手动同步内容仓库
npm run dev           # 开发（自动同步内容）
npm run build         # 生产构建：同步内容 → 更新番剧 → astro build → pagefind
npm run check         # astro check（TS 类型检查）
npm run lint          # biome check --write ./src
```

### 构建关键点（`astro.config.mjs` + `vercel.json`）

- `cssCodeSplit: false` 合并全站 CSS 为单文件（减少请求、配合 Swup persistAssets）。
- `esbuildOptions.drop: ["console","debugger"]`（生产移除日志）。
- astro-icon 用 `buildIconInclude()` 白名单打包（避免 18MB 全量图标）。
- `vercel.json`：`outputDirectory: dist`、`cleanUrls`、静态资源缓存头、安全响应头。

### 其他脚本（`scripts/`）

- `update-anime.mjs` / `update-bangumi.mjs` / `update-bilibili.mjs`：番剧数据。
- `generate-ai-summary.mjs`：DeepSeek 批量补文章 AI 摘要。
- `new-post.js`：新建文章模板。
- `indexnow-submit.js`：Bing IndexNow 提交。

---

## 13. 国际化（`src/i18n/`）

- `i18nKey.ts`：`enum I18nKey`（全部文案键）。
- `languages/{en,zh_CN,zh_TW,ja}.ts`：各语言翻译表。
- `translation.ts`：`i18n(key)` 按 `siteConfig.lang` 返回当前语言文本。
- 用法：`i18n(I18nKey.settingsThemeColor)`。

---

## 14. 开发规范与注意事项

### 新增文章

```bash
npm run new-post -- 我的新文章
# 或直接在 content/posts/ 建 .md（frontmatter 见 _frontmatter.json）
```

### 新增页面/组件

1. 组件放 `src/components/` 对应分层（atoms/organisms/widgets/features）。
2. 页面路由放 `src/pages/`。
3. 文案用 `i18n()`，不要硬编码中文。
4. 交互脚本若在 Swup 容器内，记得监听 `content:replace` 重新初始化。

### 新增配置项

1. `src/types/config.ts` 加接口。
2. `src/config/xxx.ts` 加默认值。
3. `src/config/index.ts` 导出。

### 修改 Markdown 语法

- 新增语法在 `src/plugins/` 写 remark/rehype 插件，注册到 `astro.config.mjs` 的 `markdown.processor`。

### 代码检查

```bash
npm run check   # astro check：TS 类型
npm run lint    # biome：格式 + lint
```

**目前两个检查均为 0 error / 0 warning / 0 hint。**

---

## 15. 常见问题排查

| 现象 | 原因与排查 |
|---|---|
| 构建报 frontmatter 错误 | 内容仓库脏数据；`content.config.ts` 的 preprocess 已兜底，仍失败则定位具体文章 |
| 页面切换后样式丢失 | Swup head 更新问题；检查 `updateHead` 配置与 `persistAssets` |
| 看板娘不显示 | 检查 `pioConfig`、iframe `postMessage` 协议、`public/pio/` 资源 |
| 留言板登录失败 | Twikoo 云函数版本过低（需 ≥1.6.0 支持 GET_TICKET） |
| 图标缺失 | 检查图标名是否在 `buildIconInclude()` 扫描范围内（`src/plugins/astro-icon-include.mjs`） |
| 搜索不到新文章 | 重新构建跑 pagefind |
| sync 意外提交 | `sync-content.js` 会 auto-commit；CI 环境会跳过 |

---

## 16. 关键设计决策（为什么这样写）

1. **内容分离**：多设备用 Obsidian 写文章、GitHub 同步、自动构建，杜绝直接改代码仓库。
2. **容错归一化**：`z.preprocess` 让「脏 frontmatter」只伤单篇、不炸全站。
3. **单一 CSS + Swup persistAssets**：解决站内切换样式丢失与加载慢。
4. **图标白名单**：避免 astro-icon 全量打包导致构建内存溢出。
5. **iframe 沙箱看板娘**：Live2D 库（644KB）隔离在 iframe，不污染主页面，postMessage 通信。
6. **Twikoo REST 直连**：不依赖官方 SDK 的 UI，完全自定义留言板外观与交互。
7. **音游可视化音频图常驻**：`AudioAnalyzer` 单例 + 全局 `<audio>`，切页不断声。
8. **编辑器即网页**：`/admin/:page-edit` 是纯静态壳，加载 GitHub API 读写内容仓库，实现「网站编辑内容」。
