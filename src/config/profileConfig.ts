import type { ProfileConfig } from "../types/config";

// 个人资料配置
export const profileConfig: ProfileConfig = {
	avatar: "/assets/home/avatar.webp",
	name: "YuJing",
	bio: "不怪天气不好，是我心事太多。",
	typewriter: {
		enable: true, // 启用个人简介打字机效果
		speed: 80, // 打字速度（毫秒）
	},
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/yujing0208",
		},
		{
			name: "Bilibili",
			icon: "fa7-brands:bilibili",
			url: "https://space.bilibili.com/3546385915841499",
		},
		{
			name: "QQ",
			icon: "fa7-brands:qq",
			url: "https://qm.qq.com/q/JusdxFWBiM",
		},
		{
			name: "微信",
			icon: "mdi:wechat",
			url: "weixin://contacts/profile/YuJing---168",
		},
		{
			name: "抖音",
			icon: "simple-icons:tiktok",
			url: "https://v.douyin.com/NoC2aGG5hKE/",
		},
	],
};
