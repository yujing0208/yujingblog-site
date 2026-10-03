import type { CommentConfig } from "../types/config";
import { deepMerge } from "./_settings";
// ↓ 内容仓 content/settings/comment.ts
import editable from "../settings/comment";

// ══════════════════════════════════════════════════════════════════════
// 评论系统配置（薄 Provider）
//
// 2026-09-27 起评论后端是 **Twikoo**，走 Vercel Serverless + MongoDB。
// 配置项（包括表情包）存在服务端，由 Twikoo 自己的管理面板下发 ——
// 所以这里只有"前端要连哪个后端"这几个字段，没有 emoji 列表。
//
// ⚠️ Twikoo 服务端必须配好 MONGODB_URI 才能启动，
//    否则 twikoo-vercel 的 api/index.js 会直接抛错、请求 500。
//    这条环境变量配在 Twikoo 那个 Vercel 项目里，不在这里。
//
// ⚠️ 已废弃的 Waline 整块配置本次一并删除。
//    Waline 切不回去了：components/comment/Waline.astro 组件文件早已不存在，
//    只剩 public/waline/ 的静态资源和配置文件里那句"可切回"的空头支票。
// ══════════════════════════════════════════════════════════════════════

/** 内容仓送来的扁平形状 */
type FlatComment = {
	enable?: boolean;
	system?: "twikoo";
	envId?: string;
	lang?: string;
	avatarFallback?: string;
};

const flat = deepMerge<FlatComment>(
	{
		enable: false,
		system: "twikoo",
		envId: "",
		lang: "zh-CN",
		avatarFallback: "/images/icon-error.webp",
	},
	editable,
);

export const commentConfig: CommentConfig = {
	enable: flat.enable ?? false,
	system: flat.system ?? "twikoo",
	twikoo: {
		envId: flat.envId ?? "",
		lang: flat.lang,
		avatarFallback: flat.avatarFallback,
	},
};
