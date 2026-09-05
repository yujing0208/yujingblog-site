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
	 */
	announcements: [
		{
			id: "comment-and-message-rules",
			title: "评论及留言规则",
			summary: "请在交流中保持友善、理性和尊重。",
			lead: "你不得利用本站发布、传播或实施以下行为：",
			rules: [
				"发布任何违反中华人民共和国法律法规的内容。",
				"发布任何侵犯他人合法权益的内容，包括但不限于隐私、名誉、肖像、著作权、商标权和其他知识产权。",
				"恶意攻击、辱骂、骚扰、威胁、歧视其他用户或任何第三方。",
				"发布垃圾广告、恶意推广、刷屏、灌水，或与讨论主题明显无关的重复内容。",
				"利用本站进行网络诈骗、钓鱼、传播恶意软件，或发布可能危害网络和信息安全的内容。",
				"绕越或试图绕越本站的审核、限流、封禁等管理措施。",
				"冒充他人、伪造身份，或收集、公开他人的个人信息。",
			],
		},
		{
			id: "comment-and-message-rules-2",
			title: "管理员已开启评论及留言审核",
			summary: "您发表的言论将会经过管理员审核后才会显示在页面上，请耐心等待。",
			lead: "",
			rules: [],
		},
	] as GuestbookAnnouncementItem[],
};

export type GuestbookConfig = typeof guestbookConfig;
