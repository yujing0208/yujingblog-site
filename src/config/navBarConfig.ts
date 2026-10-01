import type { NavBarConfig } from "../types/config";
import { LinkPreset } from "../types/config";
export const navBarConfig: NavBarConfig = {
	links: [
		{
			name: "首页",
			url: "/",
			icon: "lucide:house",
		},
		{
			name: "归档",
			url: "/archive/",
			icon: "lucide:archive",
		},

		// 自定义一级下拉菜单示例：外部链接集合
		{
			name: "链接",
			url: "/links/",
			icon: "lucide:link",
			children: [
				{
					name: "网站",
					url: "/websites/",
					icon: "lucide:globe",
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
					icon: "lucide:cloud",
				},
			],
		},

		// 自定义一级下拉菜单示例：个人内容页面
		{
			name: "我的",
			url: "/content/",
			icon: "lucide:user",
			children: [
				{
					name: "动态",
					url: "/diary/",
					icon: "lucide:message-circle",
				},
				LinkPreset.Anime,
				LinkPreset.Albums,
				{
					name: "设备",
					url: "/devices/",
					icon: "lucide:monitor-smartphone",
				},
				{
					name: "足迹",
					url: "/footprint/",
					icon: "lucide:map",
				},
				{
					name: "笔记本",
					url: "/notebooks/",
					icon: "lucide:book-open",
				},
			],
		},

		// 自定义一级下拉菜单示例：关于相关
		{
			name: "关于",
			url: "/content/",
			icon: "lucide:info",
			children: [
				{
					name: "关于",
					url: "/about/",
					icon: "lucide:user",
				},
				{
					name: "友链",
					url: "/friends/",
					icon: "lucide:users",
				},
				{
					name: "时间线",
					url: "/timeline/",
					icon: "lucide:chart-line",
				},
				{
					name: "更新日志",
					url: "/changelog/",
					icon: "lucide:history",
				},
			],
		},

		// 自定义一级下拉菜单示例：其他页面
		{
			name: "其他",
			url: "#",
			icon: "lucide:ellipsis",
			children: [
				{
					name: "3D 主页",
					url: "https://home.yujingblog.top",
					external: true,
					icon: "lucide:house",
				},
				{
					name: "项目",
					url: "/projects/",
					icon: "lucide:briefcase",
				},
				{
					name: "便签墙",
					url: "https://notes.yujingblog.top/",
					external: true,
					icon: "lucide:sticky-note",
				},
				{
					name: "留言板",
					url: "/guestbook/",
					icon: "lucide:message-square",
				},
				{
					name: "音乐",
					url: "/music/",
					icon: "lucide:music",
				},
			],
		},
	],
};
