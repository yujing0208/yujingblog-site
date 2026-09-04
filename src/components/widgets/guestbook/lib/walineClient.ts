/**
 * Waline 客户端（替代 Twikoo）
 */
import { commentConfig } from "@/config";

export interface WalineComment {
	objectId: string;
	nick: string;
	mail: string;
	link: string;
	comment: string;
	rid?: string;
	url: string;
	createdAt?: string;
	updatedAt?: string;
	avatar?: string;
}

let walineInstance: any = null;

function getWaline() {
	if (typeof window === 'undefined') return null;
	return walineInstance || (window as any).waline;
}

/** 初始化 Waline */
export async function initWaline(options: Record<string, any> = {}) {
	const config = commentConfig.waline || {};
	
	if (typeof window === 'undefined') return null;
	
	await loadWalineSDK();
	
	if (typeof (window as any).Waline === 'undefined') {
		throw new Error('Waline SDK 未加载');
	}
	
	walineInstance = new (window as any).Waline({
		...config,
		...options,
	});
	
	return walineInstance;
}

/** 加载 Waline SDK */
function loadWalineSDK(): Promise<void> {
	return new Promise((resolve, reject) => {
		if (typeof (window as any).Waline !== 'undefined') {
			resolve();
			return;
		}
		
		const script = document.createElement('script');
		script.src = 'https://unpkg.com/@waline/client@v3/dist/waline.js';
		script.async = true;
		script.onload = () => {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://unpkg.com/@waline/client@v3/dist/waline.css';
			document.head.appendChild(link);
			resolve();
		};
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

/** 获取评论列表 */
export async function getComments(params: {
	path: string;
	page?: number;
	pageSize?: number;
}): Promise<{ data: WalineComment[]; total: number }> {
	const waline = getWaline();
	if (!waline) throw new Error('Waline 未初始化');
	
	const result = await waline.Comment.Data.list({
		path: params.path,
		page: params.page || 1,
		pageSize: params.pageSize || 10,
	});
	
	return { data: result.data || [], total: result.count || 0 };
}

/** 提交评论 */
export async function submitComment(comment: {
	nick: string;
	mail?: string;
	link?: string;
	comment: string;
	url: string;
	rid?: string;
}): Promise<WalineComment> {
	const waline = getWaline();
	if (!waline) throw new Error('Waline 未初始化');
	
	return await waline.Comment.create(comment);
}

/** 删除评论 */
export async function deleteComment(commentId: string): Promise<void> {
	const waline = getWaline();
	if (!waline) throw new Error('Waline 未初始化');
	await waline.Comment.delete(commentId);
}

/** 更新评论 */
export async function updateComment(commentId: string, updates: Partial<WalineComment>): Promise<void> {
	const waline = getWaline();
	if (!waline) throw new Error('Waline 未初始化');
	await waline.Comment.update(commentId, updates);
}

/** 管理员登录 */
export async function loginAdmin(token: string): Promise<boolean> {
	const waline = getWaline();
	if (!waline) throw new Error('Waline 未初始化');
	
	try {
		await waline.Admin.login(token);
		return true;
	} catch {
		return false;
	}
}

/** 检查管理员登录状态 */
export async function isAdminLoggedIn(): Promise<boolean> {
	const waline = getWaline();
	if (!waline) return false;
	
	try {
		const result = await waline.Admin.check();
		return result === true;
	} catch {
		return false;
	}
}

/** 管理员登出 */
export async function logoutAdmin(): Promise<void> {
	const waline = getWaline();
	if (!waline) return;
	await waline.Admin.logout();
}

/** 获取服务端配置 */
export async function getServerConfig(): Promise<Record<string, any>> {
	const waline = getWaline();
	if (!waline) return {};
	
	try {
		return await waline.Admin.config();
	} catch {
		return {};
	}
}

/** 留言板专用路径 */
export const GUESTBOOK_PATH = "/guestbook/";