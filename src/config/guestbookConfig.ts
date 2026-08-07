/**
 * 留言板站点级配置（公告栏内容）
 * 在此文件添加公告条目，无需重新部署即可生效
 */
export interface GuestbookAnnouncementItem {
	id: string;
	title: string;
	summary: string;
	lead?: string;
	rules?: string[];
}

export const guestbookConfig = {
	/**
	 * 公告列表。
	 * 每次进入留言板时，第一条公告会自动以弹窗形式展示一次（用 localStorage 标记已读避免重复打扰）。
	 * 列表中所有条目会同时显示在留言板顶部的公告栏中（用户可关闭整个栏）。
	 *
	 * 示例：
	 *   announcements: [
	 *     {
	 *       id: "welcome",
	 *       title: "留言板上线啦",
	 *       summary: "欢迎在这里留下你的想法～",
	 *       lead: "几条小约定",
	 *       rules: ["请友善发言", "禁止广告/引战", "站长可在 Twikoo 后台管理"],
	 *     },
	 *   ]
	 */
	announcements: [] as GuestbookAnnouncementItem[],
};

export type GuestbookConfig = typeof guestbookConfig;