/**
 * 更新日志数据源（手工维护）
 * --------------------------------------------------------------------------
 * 本文件汇总自两个仓库的部署记录：
 *   - old：yujing0208/yujingblog（已废弃）
 *   - new：yujing0208/yujingblog-site（当前站点）
 *
 * 整理规则：为实现同一功能 / 修复同一问题 / 删除同一功能而产生的多次部署，
 * 合并为一条记录，相关 commit 汇总到 `commits` 字段。
 *
 * 如何新增 / 修正一条记录：
 *   1. 在数组中新增一个 ChangelogItem 对象；
 *   2. 填入 date（年-月-日 时:分:秒）、version（年.月.日）、type、category、
 *      module、title、description；commits / repo 可选；
 *   3. 页面会按 date 自动倒序、按年份分组，并支持类型与模块筛选。
 *
 * 注意：自动脚本 scripts/update-changelog.mjs 已改为「只读建议」模式，
 * 不会再覆盖本文件，可放心手工维护。
 */

import type { ChangelogItem } from "../types/changelog";

export const changelogData: ChangelogItem[] = [
	{
		id: "2026-08-10-footprint-map-swup",
		date: "2026-08-10 20:39:52",
		version: "2026.08.10",
		type: "fix",
		category: "地图重初始化",
		module: "足迹",
		title: "修复足迹页地图在站内切换后不初始化",
		description:
			"通过内联编排脚本（按顺序加载依赖）在 Swup 客户端导航后重新初始化足迹地图，解决从其他页面切换进入足迹页后地图区域空白的问题。",
		commits: ["b54f6ee"],
		repo: "new",
	},
	{
		id: "2026-08-10-devices-filter-swup",
		date: "2026-08-10 19:57:21",
		version: "2026.08.10",
		type: "fix",
		category: "分类筛选",
		module: "设备",
		title: "设备页分类筛选在站内切换后生效",
		description:
			"改用事件委托绑定分类筛选，使设备页的分类过滤在 Swup 客户端导航（而非整页刷新）后仍能正常工作。",
		commits: ["84a2edb"],
		repo: "new",
	},
	{
		id: "2026-08-10-guestbook-unify-night",
		date: "2026-08-10 19:44:04",
		version: "2026.08.10",
		type: "fix",
		category: "界面与夜间模式",
		module: "留言板",
		title: "留言板按钮统一与夜间模式对比度优化",
		description:
			"统一优化后的留言板交互，将表情 / 图片按钮同步并对齐，访客按钮移至左侧；提升夜间模式下标题与无链接访客昵称的文字对比度，修复发暗看不清的问题。",
		commits: ["448e793", "cbd9b2dd"],
		repo: "new",
	},
	{
		id: "2026-08-10-local-playback-revert",
		date: "2026-08-10 19:10:31",
		version: "2026.08.10",
		type: "removal",
		category: "本地播放",
		module: "音乐",
		title: "撤回「Always Online」本地歌曲及其播放修复",
		description:
			"撤销此前加入的「Always Online」本地歌曲，以及围绕它的播放修复提交，其余歌曲不受影响。",
		commits: ["d4172e5f"],
		repo: "new",
	},
	{
		id: "2026-08-10-local-playback-mp3",
		date: "2026-08-10 18:54:48",
		version: "2026.08.10",
		type: "fix",
		category: "本地播放",
		module: "音乐",
		title: "修复本地 MP3 与 3D 音乐页播放问题",
		description:
			"修复 3D 音乐页播放无声音（需在用户点击播放时 resume AudioContext）；修复因硬编码 crossOrigin 导致 Vercel 上本地 MP3 无法播放的问题；加入一批本地音乐并默认关闭加载自动播放。",
		commits: ["52b0303", "cfda360", "5e5e548"],
		repo: "new",
	},
	{
		id: "2026-08-10-lighthouse-perf",
		date: "2026-08-10 17:43:57",
		version: "2026.08.10",
		type: "improvement",
		category: "性能",
		module: "全局",
		title: "Lighthouse 性能优化 60→80+",
		description:
			"通过 LCP 图片预加载、延迟加载 Iconify、预连接（preconnect）及缓存头优化，将 Lighthouse 性能评分从 60 提升到 80 以上；同时重构图标加载器、图标内联与文章布局以减少重排与冗余 IO。",
		commits: ["60e7dc6", "aed5a41"],
		repo: "new",
	},
	{
		id: "2026-08-10-music-3d-cover-lrc",
		date: "2026-08-10 05:46:22",
		version: "2026.08.10",
		type: "fix",
		category: "3D 音乐页显示",
		module: "音乐",
		title: "修复 3D 音乐页封面 / 歌词 / 跳转问题",
		description:
			"修复 3D 音乐页封面不显示（改用 cover 字段配合 getAssetPath）、歌词因相对路径在子目录解析失败导致的 404；为浮窗与导航栏的音乐链接加 data-swup-ignore 强制整页加载，避免经站内导航进入时封面与歌词空白。",
		commits: ["40ac3c2", "e490880", "38f315c", "d67591d"],
		repo: "new",
	},
	{
		id: "2026-08-10-vercel-deploy-fix",
		date: "2026-08-10 04:50:38",
		version: "2026.08.10",
		type: "fix",
		category: "部署流程",
		module: "部署",
		title: "修复 Vercel 部署工作流并移除 Pages CMS",
		description:
			"修正 Vercel 部署脚本：链接项目避免交互卡死、改用 outputDirectory 直接部署 dist（去掉 --prebuilt）、去掉无效的 --project 参数改用环境变量；修复 CI 部署工作流的触发分支与令牌；移除 Pages CMS 配置。",
		commits: ["83ee4ee", "8a73977", "93ebd1b", "d9b8727", "17c1ab7"],
		repo: "new",
	},
	{
		id: "2026-08-10-local-music-upload",
		date: "2026-08-10 01:46:27",
		version: "2026.08.10",
		type: "feature",
		category: "本地曲库",
		module: "音乐",
		title: "上传 19 首本地音乐并清理残留",
		description:
			"一次性上传 19 首本地音乐（避免 Vercel 限流）；清理早期四首本地音乐残留的文件与歌单条目，以及 8-09 遗留的孤儿音频文件，保持曲库整洁。",
		commits: ["46f5d22c", "13505eeb", "d5a7e3b"],
		repo: "new",
	},
	{
		id: "2026-08-09-guestbook-owo",
		date: "2026-08-09 04:50:04",
		version: "2026.08.09",
		type: "feature",
		category: "留言板表情",
		module: "留言板",
		title: "留言板接入与评论区同源的表情包",
		description:
			"为留言板输入框增加与评论区同源的表情包，并将表情图片尺寸（77×77px）对齐评论区 OwO 表情面板。",
		commits: ["34f018c", "3c3180f6", "3fddd66d", "8d1c0a32", "01b1700e", "98bbbf20", "64dbdbfc"],
		repo: "new",
	},
	{
		id: "2026-08-09-owo-emoji-panel",
		date: "2026-08-09 02:41:58",
		version: "2026.08.09",
		type: "fix",
		category: "评论表情面板",
		module: "评论",
		title: "Twikoo 评论表情面板样式与交互修复",
		description:
			"多轮修复 Twikoo 评论表情面板：移动端显示（增大表情尺寸、颜文字防错位、底部 tab 防遮挡）、面板溢出放行 / 置顶 / 限高滚动 / 放大表情、点击面板外部自动关闭、底部分类 tab 改为图片图标、撤回到稳定版本等。",
		commits: [
			"f8497a6", "b63c409f", "def2b32", "8b34ed4", "b60f2f8", "ed5db33",
			"b093b0a0", "b4900bb1", "3baf8eb7", "029543ed", "2cbcde50", "ccae0c37",
			"8abf28a0", "6354e91b", "db82f893", "2eee2fd1", "492f5702", "ec0342de",
			"e5813eb1", "37c9d12",
		],
		repo: "new",
	},
	{
		id: "2026-08-09-twikoo-emoji-pack",
		date: "2026-08-09 00:49:59",
		version: "2026.08.09",
		type: "feature",
		category: "评论表情",
		module: "评论",
		title: "新增 Twikoo 评论表情包",
		description:
			"为 Twikoo 评论新增 13 个表情包 + 颜文字 + Emoji，共 821 张图；并为 /emoji/ 静态资源加一年不可变缓存、修复嵌套 img 标签、全部表情加懒加载。",
		commits: ["f7c018d6", "77052c1d", "905d374c"],
		repo: "new",
	},
	{
		id: "2026-08-09-guestbook-avatar-typo",
		date: "2026-08-08 23:53:56",
		version: "2026.08.08",
		type: "fix",
		category: "界面文案",
		module: "留言板",
		title: "游客访问与发送按钮文字间距调整",
		description: "将留言板的游客访问 / 发送按钮文字间距调整为 2 个中文字符，提升可读性。",
		commits: ["39c40700"],
		repo: "new",
	},
	{
		id: "2026-08-08-twikoo-sdk-timeout",
		date: "2026-08-08 20:18:51",
		version: "2026.08.08",
		type: "fix",
		category: "评论稳定性",
		module: "评论",
		title: "升级 Twikoo SDK 并加请求超时",
		description:
			"将 Twikoo 前端 SDK 升级到 1.7.14（引用加 ?v=1.7.14 版本参数）；为 Twikoo API 请求加 10s 超时，服务端卡死时不再一直显示骨架屏。",
		commits: ["1db1d7c2", "e8c7c2c3", "675dbdb4", "956086c5"],
		repo: "new",
	},
	{
		id: "2026-08-08-visual-editor",
		date: "2026-08-08 12:27:38",
		version: "2026.08.08",
		type: "feature",
		category: "在线编辑器",
		module: "编辑器",
		title: "可视化在线编辑器（Pages CMS 改造）",
		description:
			"上线可视化在线编辑器：新增 admin 后台路由、暴露 EditorLogin 并注入弹窗样式、看板娘菜单增加编辑入口、使用精确选择器避免劫持导航菜单链接、单条编辑改为暂存 + 统一推送、修复 commitTree 批量推送 404（PATCH ref 端点改用复数 /git/refs/）。",
		commits: [
			"e999f9c3", "ea6cb8d0", "fa947cf8", "df6b4b2e", "a9a529bb", "d4fba88a",
			"057b9fee", "0083457a", "3a24228d", "397aff49", "fe66b252", "9c3f47ee",
			"aff9d613", "9b0d4170", "9cc378d5", "54fe47dd", "761e0050", "f744ef9c",
			"070aa1cf", "06a206a6", "5f2553e9", "65610642", "548d4ce7", "cdbabb2f",
			"f6a4f56d", "47343bda",
		],
		repo: "new",
	},
	{
		id: "2026-08-08-anime-games",
		date: "2026-08-08 10:51:08",
		version: "2026.08.08",
		type: "feature",
		category: "游戏卡片",
		module: "追番",
		title: "追番页游戏条目样式与字段重构",
		description:
			"重构追番页游戏卡片：正方形图标 + 下方小号名称、去卡片底色与边框、隐藏状态角标 / 评分 / 播放按钮；小说状态增加「搁置」、字段由「制作 / 集数」改为「作者 / 册数」；状态子筛选按大分类（动漫 / 小说 / 游戏）切换并默认仅显示当前分类；修复集数空白与所有分类详细信息（年份 / 制作 / 标签 / 集数）显示。",
		commits: [
			"c32bc6be", "6fd7ce4a", "86074482", "317711d8", "986119cc", "5ad79bca",
			"9a1015a1", "1f3d66a4", "9e496a26", "ffb6e9c5", "40b71450", "e3748b76",
			"663a4a32", "91bfbb76", "7dc12a18", "370acd08", "6534dd5a", "2defd503",
		],
		repo: "new",
	},
	{
		id: "2026-08-08-diary-night-mode",
		date: "2026-08-07 23:18:52",
		version: "2026.08.07",
		type: "fix",
		category: "夜间模式",
		module: "日记",
		title: "修复日记页夜间模式文字不可见",
		description: "将日记页夜间模式内容文字改为白色，修复因引用未定义的 --text-color 变量导致文字看不清的问题。",
		commits: ["47343bda"],
		repo: "new",
	},
	{
		id: "2026-08-07-08-music-local-default-resume",
		date: "2026-08-07 16:10:37",
		version: "2026.08.07",
		type: "fix",
		category: "本地播放与续播",
		module: "音乐",
		title: "音乐本地默认模式与断点续播增强",
		description:
			"来自旧仓库 yujingblog 的若干音乐播放修复，与站点仓库后续提交合并为同一主题：默认本地歌单（移除全局本地 / 网易云切换，仅 3D 页保留切换面板）、修复整页刷新后续播失效（初始化先捕获快照再加载歌单）、增强断点续播（网易云歌曲刷新后恢复同一首）。",
		commits: [
			"330b03a", "d188861", "3d7f0d6", "e896eb2", "d40194c", "61f884e",
			"9a1eb1f", "e45f569", "863092fe", "c7cd8838", "a64f601", "d2dc5b0",
		],
		repo: "new",
	},
];
