/**
 * Twikoo 客户端（URL 模式 / 私有部署）
 *
 * 协议于 2026-08-04 对 twikoo.yujingblog.top (v1.7.14) 实测验证：
 *   POST {envId}  Content-Type: application/json
 *   body: { "event": "<ACTION>", ...参数, "accessToken": <localStorage 会话令牌|null>, "envId": <envId> }
 *   响应：直接返回 JSON，形如 { data, more, count, accessToken } / { id, ... }
 *   响应中的 accessToken 为服务端签发的访客会话令牌，客户端需保存并回传（用于删除自己评论的鉴权）
 *
 * 复用站点现有 commentConfig.twikoo.envId，与文章评论同源。
 */
import { commentConfig } from "@/config";
import type { TwikooComment } from "./types";

/** 留言板专用频道路径（独立于文章评论） */
export const GUESTBOOK_PATH = "/guestbook/";

const ENV_ID = commentConfig.twikoo?.envId ?? "";
const ACCESS_TOKEN_KEY = "twikoo-access-token";
const LANG = "zh-CN";

function readAccessToken(): string | null {
	try {
		return localStorage.getItem(ACCESS_TOKEN_KEY);
	} catch {
		return null;
	}
}

function saveAccessToken(token: string) {
	try {
		localStorage.setItem(ACCESS_TOKEN_KEY, token);
	} catch {
		// 隐私模式下忽略
	}
}

/** 与官方 SDK 一致的请求封装；返回服务端原始 JSON */
async function call<T>(
	action: string,
	params: Record<string, unknown> = {},
): Promise<T> {
	if (!ENV_ID) {
		throw new Error("Twikoo 服务地址未配置");
	}
	const accessToken = readAccessToken();
	const response = await fetch(ENV_ID, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			event: action,
			accessToken,
			envId: ENV_ID,
			...params,
		}),
	});
	if (!response.ok) {
		throw new Error(`留言服务请求失败 (${response.status})`);
	}
	const json = (await response.json()) as Record<string, unknown> & {
		accessToken?: string;
		code?: number;
		message?: string;
	};
	if (typeof json.accessToken === "string") {
		saveAccessToken(json.accessToken);
	}
	if (typeof json.code === "number" && json.code !== 0) {
		const error = new Error(
			(typeof json.message === "string" ? json.message : "留言服务异常") +
				` (${json.code})`,
		);
		throw error;
	}
	return json as T;
}

export interface CommentGetResult {
	data: TwikooComment[];
	more: boolean;
	count: number;
}

/** COMMENT_GET：分页拉取某频道的评论树 */
export async function getComments(
	page: number,
	pageSize: number,
): Promise<CommentGetResult> {
	return call<CommentGetResult>(
		"COMMENT_GET",
		{
			url: GUESTBOOK_PATH,
			page,
			pageSize,
			lang: LANG,
		},
	);
}

export interface SubmitCommentOptions {
	nick: string;
	mail?: string;
	link?: string;
	/** HTML 正文 */
	comment: string;
	/** 直接父评论 id */
	pid?: string;
	/** 根评论 id */
	rid?: string;
}

/** COMMENT_SUBMIT：提交评论，返回服务端生成的评论（至少含 id） */
export async function submitComment(
	options: SubmitCommentOptions,
): Promise<Partial<TwikooComment> & { id: string }> {
	const result = await call<Partial<TwikooComment> & { id: string }>(
		"COMMENT_SUBMIT",
		{
			nick: options.nick,
			mail: options.mail || "",
			link: options.link || "",
			ua: navigator.userAgent,
			url: GUESTBOOK_PATH,
			href: window.location.href,
			comment: options.comment,
			pid: options.pid ?? undefined,
			rid: options.rid ?? undefined,
		},
	);
	if (!result.id) {
		throw new Error("评论提交失败，请稍后重试");
	}
	return result;
}

/** COMMENT_DELETE_FOR_USER：访客删除自己的评论（需会话令牌，客户端自动带上） */
export async function deleteComment(commentId: string): Promise<void> {
	await call("COMMENT_DELETE_FOR_USER", {
		url: GUESTBOOK_PATH,
		id: commentId,
	});
}

/** COMMENT_LIKE：点赞 / 取消点赞 */
export async function likeComment(
	commentId: string,
	like?: boolean,
): Promise<{ likes: number }> {
	return call<{ likes: number }>("COMMENT_LIKE", {
		url: GUESTBOOK_PATH,
		commentId,
		like: like ?? true,
	});
}

/** GET_RECENT_COMMENTS：最近评论（侧边栏可选展示） */
export async function getRecentComments(
	limit = 6,
): Promise<{ comments: TwikooComment[]; count: number }> {
	return call<{ comments: TwikooComment[]; count: number }>(
		"GET_RECENT_COMMENTS",
		{ limit, url: GUESTBOOK_PATH, lang: LANG },
	);
}
