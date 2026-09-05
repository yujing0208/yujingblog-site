import type { CommentConfig } from "../types/config";
import { SITE_LANG } from "./siteConfig";

// 评论系统配置
export const commentConfig: CommentConfig = {
	enable: true, // 启用评论功能。当设置为 false 时，评论组件将不会显示在文章区域。
	system: "waline", // 评论系统选择: "waline" | "twikoo" | "giscus"
	waline: {
		serverURL: "https://waline.yujingblog.top", // Waline 服务端地址
		lang: SITE_LANG,
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
