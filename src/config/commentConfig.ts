import type { CommentConfig } from "../types/config";

// 评论系统配置
//
// 说明（2026-09-27）：
//   留言板已按「照搬 homulilly.com/comment/」重建，后端随之切回 **Twikoo**。
//   Waline 那套聊天室（GuestbookChat.svelte，43KB）已废弃不再引用。
//
//   ⚠️ Twikoo 服务端必须配置 MONGODB_URI 才能启动：
//      twikoo-vercel 的 api/index.js 里写死
//      `if (!uri) throw new Error('未设置环境变量 MONGODB_URI')`
//      所以 Vercel 项目里必须存在这一条环境变量，否则请求会直接 500。
export const commentConfig: CommentConfig = {
	enable: true, // 启用评论功能。当设置为 false 时，评论组件将不会显示在文章区域。
	system: "twikoo", // 评论系统选择: "waline" | "twikoo" | "giscus"

	// Twikoo 配置
	twikoo: {
		// Twikoo 云函数地址（含 https://，不带路径）。
		// 若尚未部署自己的 Twikoo，这里留空则留言墙会显示「留言加载失败」，
		// 但页面本身不会报错。
		envId: "https://twikoo.yujingblog.top",
		lang: "zh-CN",
		// 访客头像加载失败时的兜底图
		avatarFallback: "/images/icon-error.webp",
	},

	// Waline 配置（保留但已不再用于留言板；文章评论区如需可切回 system: "waline"）
	waline: {
		serverURL: "https://waline.yujingblog.top", // Waline 服务端地址
		// ⚠️ 不要改回 SITE_LANG（值是 "zh_CN"，带下划线）。
		//    Waline 查语言包时只做 toLowerCase()，语言包 key 形如 "zh-cn" / "en-us"，
		//    所以 "zh_cn" 查不到，会静默回退到英文（`B[lang.toLowerCase()] ?? B["en-us"]`），
		//    评论区就整体变英文了。必须写成带连字符的形式才认。
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
