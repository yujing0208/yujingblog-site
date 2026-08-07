// 友情链接数据配置
// 用于管理友情链接页面的数据
import type { FriendItem } from "../types/friends";
const friendsData: FriendItem[] = [
	{
		id: 1,
		title: "MEMZGBL的博客",
		imgurl:
			"https://blog.mcstarland.top/assets/home/default-logo.png",
		desc: "Mizuki User Manual",
		siteurl: "https://blog.mcstarland.top",
		tags: ["博客"],
	},
	{
		id: 2,
		title: "Elykia",
		imgurl:
			"https://bu.dusays.com/2024/10/25/671b2438203a6.gif",
		desc: "致以无瑕之人",
		siteurl: "https://blog.elykia.cn/",
		tags: ["博客"],
	},
	{
		id: 3,
		title: "XiaoWangのBlog~",
		imgurl:
			"https://image.xiaowang233.top/ts.png",
		desc: "「又一个 WordPress 站点」",
		siteurl: "https://blog.xiaowang233.top",
		tags: ["博客"],
	},
	{
		id: 4,
		title: "山羊快车Blog",
		imgurl:
			"https://r2page.jiaoblog.dpdns.org/images/aebcb8f461af86e7df331bee79fa5d0953dbaeed.png",
		desc: "发布各种白嫖资源/实用教程",
		siteurl: "https://blog.xiaowang233.top",
		tags: ["博客"],
	},
	{
		id: 5,
		title: "Inalineの小站",
		imgurl:
			"https://inaline.net/usr/themes/inaline/assets/images/logo/cover.png",
		desc: "此情可待成追忆，只是当时已惘然",
		siteurl: "https://inaline.net",
		tags: ["博客"],
	},
	{
		id: 6,
		title: "孟轩科技's blog",
		imgurl:
			"https://blog.mxw2024.top/assets/images/favicon.ico",
		desc: "一个简洁、美观、纯净、无广告的小站",
		siteurl: "https://blog.mxw2024.top/",
		tags: ["博客"],
	},
	{
		id: 7,
		title: "孟轩网的小站",
		imgurl:
			"https://blog.mxw2024.top/assets/images/favicon.ico",
		desc: "一个简洁、美观、纯净、无广告的小站",
		siteurl: "https://www.mxw2024.top/",
		tags: ["博客"],
	},
	{
		id: 8,
		title: "Ariasakaの小窝",
		imgurl:
			"https://img.0v0.my/2024/12/05/67517bcf104da.png",
		desc: "人有悲欢离合 月有阴晴圆缺",
		siteurl: "https://blog.yaria.top",
		tags: ["博客"],
	},
	{
		id: 9,
		title: "阿叶Ayeez的小站",
		imgurl:
			"https://qiniu.ayeez.cn/avatar.jpg",
		desc: "记录学习历程，记录美好生活",
		siteurl: "https://blog.Ayeez.cn",
		tags: ["博客"],
	},
	{
		id: 10,
		title: "ZY知识库",
		imgurl:
			"https://blog.pljzy.top/_astro/logo.BxIxyJV1_Z19cEQW.webp",
		desc: "一个技术探索与分享的平台",
		siteurl: "https://blog.pljzy.top/",
		tags: ["博客"],
	},
	{
		id: 11,
		title: "Liseezn'blog",
		imgurl:
			"https://blog.liseezn.top/logo.webp",
		desc: "分享学习，项目，及教程",
		siteurl: "https://blog.liseezn.top",
		tags: ["博客"],
	},
	{
		id: 12,
		title: "谶的生活记",
		imgurl:
			"https://blog.fohok.xin/wp-content/uploads/2026/04/wp-17708563798823983127499835001104525740135945006403.png",
		desc: "生活就像一杯茶,细品都是好",
		siteurl: "https://blog.fohok.xin/",
		tags: ["博客"],
	},
	{
		id: 13,
		title: "彬红茶日记",
		imgurl:
			"https://note.redcha.cn/upload/favicon-256x256.png",
		desc: "我的个人笔记📒",
		siteurl: "https://note.redcha.cn",
		tags: ["博客"],
	},
	{
		id: 14,
		title: "XingHuiSamaの宝藏之地",
		imgurl:
			"https://bu.dusays.com/2026/03/24/69c1e38ac1846.jpg",
		desc: "今天我也要学习吗",
		siteurl: "https://www.xinghuisama.top/",
		tags: ["博客"],
	}
];
export function getFriendsList(): FriendItem[] {
	return friendsData;
}
export function getShuffledFriendsList(): FriendItem[] {
	const shuffled = [...friendsData];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

// deployment refresh: force Vercel git cache to refetch this module
