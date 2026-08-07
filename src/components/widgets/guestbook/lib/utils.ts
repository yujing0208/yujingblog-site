/**
 * 留言板工具函数：评论树扁平化、合并、头像解析、时间格式化、Markdown 渲染
 */
import { marked } from "marked";
import { convertEmojiShortcodes } from "./emoji";
import type { GuestbookMessage, TwikooComment } from "./types";

export const MIN_MESSAGE_LENGTH = 2;
export const MAX_MESSAGE_LENGTH = 300;

/** 解析头像：优先评论自带，否则用 mailMd5 拼 Gravatar */
export function resolveAvatar(comment: TwikooComment): string {
	if (comment.avatar) return comment.avatar;
	if (comment.mailMd5) {
		return `https://cravatar.cn/avatar/${comment.mailMd5}?d=identicon&f=y`;
	}
	return "";
}

/** 取昵称首字（头像兜底显示） */
export function getInitials(nick: string): string {
	const chars = Array.from(nick.trim());
	return chars.length > 0 ? chars[0] : "客";
}

/** 将一条 Twikoo 评论树节点规范化为内部消息模型 */
export function normalizeComment(comment: TwikooComment): GuestbookMessage {
	const replyTarget = comment.pid || comment.rid || undefined;
	return {
		id: comment.id,
		nick: comment.nick,
		avatar: resolveAvatar(comment),
		link: comment.link || undefined,
		body: comment.comment,
		createdAt: comment.created,
		isAdmin: Boolean(comment.master),
		isOwner: Boolean(comment.isOwner),
		replyToId: replyTarget,
		replyToNick: comment.ruser?.nick,
		browser: comment.browser,
		os: comment.os,
		addr: comment.ipRegion,
		label: comment.status === "waiting" ? "审核中" : undefined,
	};
}

/** 扁平化一页评论树：顶层 + 其所有子回复（子回复按时间升序），并整体按时间升序 */
export function flattenComments(comments: TwikooComment[]): GuestbookMessage[] {
	const messages: GuestbookMessage[] = [];
	for (const top of comments) {
		messages.push(normalizeComment(top));
		const replies = [...(top.replies ?? [])].sort(
			(a, b) => a.created - b.created,
		);
		for (const reply of replies) {
			messages.push(normalizeComment(reply));
		}
	}
	messages.sort((a, b) => a.createdAt - b.createdAt);
	return messages;
}

/** 合并两批消息（按 id 去重，本地发送中的消息优先保留），并保持时间升序 */
export function mergeMessages(
	current: GuestbookMessage[],
	incoming: GuestbookMessage[],
): GuestbookMessage[] {
	const byId = new Map<string, GuestbookMessage>();
	for (const message of current) {
		byId.set(message.id, message);
	}
	for (const message of incoming) {
		const existing = byId.get(message.id);
		if (!existing) {
			byId.set(message.id, message);
			continue;
		}
		// 服务端数据到达后，覆盖本地乐观消息，但保留失败状态
		if (existing.localState === "sending") {
			byId.set(message.id, { ...message });
		} else if (!existing.localState && message.localState === "failed") {
			byId.set(message.id, message);
		}
	}
	return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

/** 时间格式化：MM/DD HH:mm */
export function formatMessageTime(value: number): string {
	return new Intl.DateTimeFormat("zh-CN", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(value);
}

/** 日期键：YYYY-MM-DD */
export function dateKey(value: number): string {
	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(value);
}

/** 日期标签：今天 / 昨天 / YYYY-MM-DD */
export function dateLabel(value: number): string {
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	if (dateKey(value) === dateKey(today.getTime())) return "今天";
	if (dateKey(value) === dateKey(yesterday.getTime())) return "昨天";
	return dateKey(value);
}

export function shouldShowDate(index: number, messages: GuestbookMessage[]): boolean {
	return (
		index === 0 ||
		dateKey(messages[index - 1].createdAt) !== dateKey(messages[index].createdAt)
	);
}

/** 纯文本长度（去 HTML 与空白） */
export function getTextLength(content: string): number {
	const stripped = content
		.replace(/<[^>]*>/gu, "")
		.replace(/!\[[^\]]*\]\([^)]*\)/gu, "");
	return Array.from(stripped.replace(/\s/gu, "")).length;
}

/** 是否包含图片（markdown 或 HTML 形式） */
export function hasImage(content: string): boolean {
	return /!\[[^\]]*\]\([^)]*\)/u.test(content) || /<img[^>]*>/u.test(content);
}

/** 校验消息正文，返回错误文案（空串表示通过） */
export function validateMessageBody(content: string): string {
	const textLength = getTextLength(content);
	if (textLength < MIN_MESSAGE_LENGTH && !hasImage(content)) {
		return `消息至少需要 ${MIN_MESSAGE_LENGTH} 个字符`;
	}
	if (textLength > MAX_MESSAGE_LENGTH) {
		return `消息不能超过 ${MAX_MESSAGE_LENGTH} 个字符`;
	}
	if (/^@[^\s@]+\s/u.test(content)) {
		return "消息内容不能以引用标记开头";
	}
	return "";
}

/**
 * 将 markdown 转换为可安全展示的 HTML（与官方 Twikoo 客户端一致，用 marked）
 * 说明：Twikoo 服务端对评论内容有 XSS 净化（isSpam 过滤），此处仅做展示转换
 * 渲染前会先把 ":key:" 短码（如 :微笑:）转成 markdown 图片，行为与 Twikoo 原评论区一致
 */
export function renderMessageMarkdown(content: string): string {
	const enriched = convertEmojiShortcodes(content);
	const html = marked.parse(enriched, {
		gfm: true,
		breaks: true,
	}) as string;
	return html;
}

/* ============================================================
   图片内嵌工具（base64 ≤128KB，零服务端依赖）
   ============================================================ */
export const MAX_IMAGE_SIZE_BYTES = 128 * 1024;

export const SUPPORTED_IMAGE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
]);

/** 把 File 读成 data URL；超限或不支持类型返回 null，错误信息通过 reason 返回 */
export async function readImageAsDataUrl(
	file: File,
): Promise<{ url: string; size: number; name: string } | { error: string }> {
	if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
		return { error: "仅支持 PNG / JPEG / GIF / WebP 图片" };
	}
	if (file.size > MAX_IMAGE_SIZE_BYTES) {
		return { error: `图片不能超过 ${MAX_IMAGE_SIZE_BYTES / 1024} KB` };
	}
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
	return { url: dataUrl, size: file.size, name: file.name };
}

/** 从 clipboard items 或 drop 中提取图片文件 */
export function extractImageFile(blob: Blob | null | undefined): File | null {
	if (!blob || typeof blob !== "object") return null;
	if (typeof (blob as File).name === "string" && blob instanceof Blob) {
		return blob as File;
	}
	return null;
}
