import type { BooknavConfig } from "../types/booknavConfig";

/**
 * 书签导航数据。
 * 源数据来自旧 /websites/ 页面（content/data/website.ts），迁移为 Firefly 主题书签导航风格。
 */
export const booknavConfig: BooknavConfig = {
	title: "网站收藏",
	subtitle: "收藏一些好用的网站，按分类整理",
	placeholder: "搜索书签...",
	categories: [
		{
			id: "dev",
			name: "开发",
			description: "写代码时离不开的站点",
			icon: "material-symbols:code",
			items: [
				{
					name: "GitHub",
					description: "全球最大的代码托管平台",
					url: "https://github.com",
					icon: "simple-icons:github",
					color: "#181717",
				},
				{
					name: "MDN Web Docs",
					description: "最权威的 Web 文档",
					url: "https://developer.mozilla.org",
					icon: "simple-icons:mdnwebdocs",
					color: "#000000",
				},
				{
					name: "Astro",
					description: "内容驱动型网站的 Web 框架",
					url: "https://astro.build",
					icon: "simple-icons:astro",
					color: "#BC52EE",
				},
				{
					name: "Svelte",
					description: "把组件编译成高效原生 JS 的框架",
					url: "https://svelte.dev",
					icon: "simple-icons:svelte",
					color: "#FF3E00",
				},
				{
					name: "Tailwind CSS",
					description: "一个功能强大且灵活的 CSS 框架",
					url: "https://tailwindcss.com",
					icon: "simple-icons:tailwindcss",
					color: "#06B6D4",
				},
			],
		},
		{
			id: "project",
			name: "项目",
			description: "好用的开源项目",
			icon: "material-symbols:folder",
			items: [
				{
					name: "Firefly",
					description: "清晰美观的 Astro 个人博客主题模板",
					url: "https://github.com/Moelten/astro-theme-firefly",
					icon: "simple-icons:astro",
					color: "#BC52EE",
				},
			],
		},
		{
			id: "design",
			name: "设计",
			description: "配色、图标与灵感来源",
			icon: "material-symbols:brush",
			items: [
				{
					name: "Iconify",
					description: "海量开源图标集合搜索",
					url: "https://iconify.design",
					icon: "simple-icons:iconify",
					color: "#1769AA",
				},
				{
					name: "iconfont",
					description: "阿里巴巴矢量图标库",
					url: "https://www.iconfont.cn",
					icon: "simple-icons:alibabadotcom",
					color: "#FF6A00",
				},
			],
		},
		{
			id: "tool",
			name: "工具",
			description: "顺手的在线小工具",
			icon: "material-symbols:build",
			items: [
				{
					name: "TinyPNG",
					description: "在线压缩 PNG / JPEG 图片",
					url: "https://tinypng.com",
					icon: "simple-icons:tinypng",
					color: "#0070E0",
				},
				{
					name: "Squoosh",
					description: "Google 出品的图片压缩与格式转换",
					url: "https://squoosh.app",
					icon: "simple-icons:google",
					color: "#4285F4",
				},
				{
					name: "Carbon",
					description: "把代码片段生成漂亮的图片",
					url: "https://carbon.now.sh",
					icon: "simple-icons:carbon",
					color: "#000000",
				},
			],
		},
		{
			id: "resource",
			name: "资源",
			description: "文档、教程与阅读",
			icon: "material-symbols:menu-book",
			items: [
				{
					name: "Firefly Docs",
					description: "Firefly 主题模板文档",
					url: "https://firefly.cuteleaf.cn/docs/",
					icon: "simple-icons:astro",
					color: "#BC52EE",
				},
				{
					name: "夏夜流萤",
					description: "飞萤之火自无梦的长夜亮起",
					url: "https://firefly.cuteleaf.cn",
					icon: "material-symbols:local-fire-department",
					color: "#F59E0B",
				},
			],
		},
	],
};
