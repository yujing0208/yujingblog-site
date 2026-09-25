import type { CommentConfig } from "../types/config";

// 评论系统配置
export const commentConfig: CommentConfig = {
	enable: true, // 启用评论功能。当设置为 false 时，评论组件将不会显示在文章区域。
	system: "waline", // 评论系统选择: "waline" | "twikoo" | "giscus"
	waline: {
		serverURL: "https://waline.yujingblog.top", // Waline 服务端地址
		// ⚠️ 不要改回 SITE_LANG（值是 "zh_CN"，带下划线）。
		//    Waline 查语言包时只做 toLowerCase()，语言包 key 形如 "zh-cn" / "en-us"，
		//    所以 "zh_cn" 查不到，会静默回退到英文（`B[lang.toLowerCase()] ?? B["en-us"]`），
		//    评论区就整体变英文了。必须写成带连字符的形式才认。
		//    这里的 lang 同时被留言板（GuestbookChat）用，改动会一并生效。
		lang: "zh-CN",
		locale: {
			placeholder: "欢迎留言交流～",
		},
		emoji: [
			"https://unpkg.com/@waline/emojis@1.4.0/weibo",
			"https://unpkg.com/@waline/emojis@1.4.0/bilibili",
			"https://unpkg.com/@waline/emojis@1.4.0/bmoji",
		],
		meta: ["nick", "mail", "link"],
		requiredMeta: [],
		login: "enable",
		wordLimit: [0, 2000],
		pageSize: 10,
		visitorCount: false,
		highlighter: false,
		imageUploader: false,
		texRenderer: false,
		search: false,
		reaction: false,
	},
};
