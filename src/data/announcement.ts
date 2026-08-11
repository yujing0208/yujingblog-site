// 公告栏数据配置
// 同步后自动覆盖 src/data/announcement.ts
//
// 多则公告用法（content 支持三种形态）：
//   1. 纯字符串：content: "单条公告"
//   2. 对象：content: { content: "...", link: {...} }
//   3. 数组（推荐）：content: ["...", { content: "...", link: {...} }, "..."]
//      · 数组项可为字符串或对象，混合使用
//      · 每则对象可独立配置 link（不配置则使用下方全局 link）
//      · interval: 自动播放间隔（毫秒），默认 4000

export interface AnnouncementLink {
	enable?: boolean; // 是否启用链接
	text: string; // 链接文字
	url: string; // 链接地址
	external?: boolean; // 是否外部链接
}

export interface AnnouncementItem {
	content: string; // 公告正文
	link?: AnnouncementLink; // 独立链接（可选，覆盖全局默认链接）
}

export interface AnnouncementData {
	title: string;
	content: string | AnnouncementItem | (string | AnnouncementItem)[];
	closable: boolean;
	interval?: number; // 自动播放间隔（毫秒），默认 4000
	link?: AnnouncementLink; // 全局默认链接（每则可独立覆盖）
}

export const announcementData: AnnouncementData = {
	title: "",
	content: [
		"又换博客啦！欢迎访问 YuJing 的小站；想访问旧站的可以点击下方「Learn More」按钮",
		{
			content: "便签墙上线啦！欢迎留下你的足迹与祝福，点击下方「去留言」开始～",
			link: {
				enable: true,
				text: "去留言",
				url: "https://notes.yujingblog.top/",
				external: true
			}
		},
		{
			content: "增加了一个QQ 群聊风格的留言板，快去试试~",
			link: {
				enable: true,
				text: "去留言",
				url: "https://www.yujingblog.top/guestbook/",
				external: false
			}
		}
	],
	interval: 4000,
	closable: true,
	link: {
		enable: true,
		text: "Learn More",
		url: "https://old.yujingblog.top",
		external: true
	}
};
