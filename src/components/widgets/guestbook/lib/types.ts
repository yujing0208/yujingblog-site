/**
 * 留言板数据类型（Twikoo 后端协议 + 内部消息模型）
 */

/** Twikoo 服务端返回的评论对象（COMMENT_GET 实测结构，2026-08-04） */
export interface TwikooComment {
	id: string;
	nick: string;
	/** 头像 URL，可能为 null（此时用 mailMd5 拼 Gravatar） */
	avatar: string | null;
	mailMd5?: string;
	link?: string;
	/** HTML 内容（服务端已做 Markdown 转换与净化） */
	comment: string;
	os?: string;
	browser?: string;
	ipRegion?: string;
	/** 是否为站长（管理员）评论 */
	master?: boolean;
	like?: number;
	ups?: number;
	downs?: number;
	liked?: boolean;
	disliked?: boolean;
	/** 子回复（树形） */
	replies?: TwikooComment[];
	/** 根评论 id */
	rid?: string | null;
	/** 直接父评论 id */
	pid?: string | null;
	ruser?: { nick?: string } | null;
	isSpam?: boolean;
	/** 当前访客是否为该评论的发布者（用 session accessToken 判定） */
	isOwner?: boolean;
	/** 毫秒时间戳 */
	created: number;
	updated?: number;
	/** 审核状态："" | "waiting" 等 */
	status?: string;
}

export interface CommentGetResult {
	data: TwikooComment[];
	more: boolean;
	count: number;
}

/** 留言板内部消息模型（聊天流扁平化后的气泡数据） */
export interface GuestbookMessage {
	id: string;
	nick: string;
	/** 已解析的头像 URL（可能为空串，气泡显示首字母） */
	avatar: string;
	link?: string;
	/** HTML 正文 */
	body: string;
	/** 毫秒时间戳 */
	createdAt: number;
	isAdmin: boolean;
	isOwner?: boolean;
	/** 引用回复目标 */
	replyToId?: string;
	replyToNick?: string;
	browser?: string;
	os?: string;
	addr?: string;
	label?: string;
	/** 本地状态：发送中 / 发送失败 */
	localState?: "sending" | "failed";
	failureReason?: string;
}

/** 游客资料（存 localStorage） */
export interface GuestbookProfile {
	nick: string;
	mail: string;
	link: string;
}
