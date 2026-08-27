import type { NavBarConfig } from "../types/config";
import { LinkPreset } from "../types/config";
export const navBarConfig: NavBarConfig = {
	links: [
		{
			name: "首页",
			url: "/",
			icon: "material-symbols:home",
		},
		{
			name: "归档",
			url: "/archive/",
			icon: "material-symbols:archive",
		},

		// 自定义一级下拉菜单示例：外部链接集合
		{
			name: "Links",
			url: "/links/",
			icon: "material-symbols:link",
			children: [
				{
					name: "网站",
					url: "/websites/",
					icon: "material-symbols:public",
				},
				{
					name: "抖音",
					url: "https://v.douyin.com",
					external: true,
					icon: "simple-icons:tiktok",
				},
				{
					name: "Deepseek",
					url: "https://chat.deepseek.com/",
					external: true,
					icon: "simple-icons:deepseek",
				},
				{
					name: "GitHub",
					url: "https://github.com",
					external: true,
					icon: "fa7-brands:github",
				},
				{
					name: "Vercel",
					url: "https://vercel.com/yujing",
					external: true,
					icon: "gg:vercel",
				},
				{
					name: "Umami.",
					url: "https://cloud.umami.is/analytics/us/websites",
					external: true,
					icon: "bitcoin-icons:cloud-outline",
				},
			],
		},

		// 自定义一级下拉菜单示例：个人内容页面
		{
			name: "My",
			url: "/content/",
			icon: "material-symbols:person",
			children: [
				{
					name: "动态",
					url: "/diary/",
					icon: "material-symbols:chat",
				},
				LinkPreset.Anime,
				LinkPreset.Albums,
				{
					name: "Devices",
					url: "/devices/",
					icon: "material-symbols:devices",
				},
				{
					name: "足迹",
					url: "/footprint/",
					icon: "material-symbols:map",
				},
			],
		},

		// 自定义一级下拉菜单示例：关于相关
		{
			name: "About",
			url: "/content/",
			icon: "material-symbols:info",
			children: [
				{
					name: "About",
					url: "/about/",
					icon: "material-symbols:person",
				},
				{
					name: "友链",
					url: "/friends/",
					icon: "material-symbols:group",
				},
				{
					name: "Timeline",
					url: "/timeline/",
					icon: "material-symbols:timeline",
				},
				{
					name: "更新日志",
					url: "/changelog/",
					icon: "material-symbols:history",
				},
			],
		},

		// 自定义一级下拉菜单示例：其他页面
		{
			name: "Others",
			url: "#",
			icon: "material-symbols:more-horiz",
			children: [
				{
					name: "项目",
					url: "/projects/",
					icon: "material-symbols:work",
				},
				{
					name: "便签墙",
					url: "https://notes.yujingblog.top/",
					external: true,
					icon: "material-symbols:sticky-note",
				},
				{
					name: "留言板",
					url: "/guestbook/",
					icon: "material-symbols:chat-bubble",
				},
				{
					name: "音乐",
					url: "/music/",
					icon: "material-symbols:music-note",
				},
			],
		},
	],
};
