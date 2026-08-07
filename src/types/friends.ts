// 友情链接 / 网站 数据项类型定义
// friends.ts 与 website.ts 共用
export interface FriendItem {
	id: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string[];
}
