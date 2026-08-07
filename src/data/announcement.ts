// 公告栏数据配置
// 同步后自动覆盖 src/data/announcement.ts

export interface AnnouncementData {
	title: string;
	content: string;
	closable: boolean;
	link: {
		enable: boolean;
		text: string;
		url: string;
		external: boolean;
	};
}

export const announcementData: AnnouncementData = {
	title: "",
	content: "又换博客啦！欢迎访问YuJing的小站; 想访问旧站的可以点击下方[Learn More] 按钮",
	closable: true,
	link: {
		enable: true,
		text: "Learn More",
		url: "https://old.yujingblog.top",
		external: true,
	},
};
