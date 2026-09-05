// 友情链接数据配置
// 用于管理友情链接页面的数据
import type { FriendItem } from "../types/friends";
const friendsData: FriendItem[] = [
	{
		id: 1,
		title: "MEMZGBL的博客",
		imgurl: "https://blog.mcstarland.top/assets/home/default-logo.png",
		desc: "Mizuki User Manual",
		siteurl: "https://blog.mcstarland.top",
		tags: [
			"博客"
		]
	},
	{
		id: 2,
		title: "Elykia",
		imgurl: "https://bu.dusays.com/2024/10/25/671b2438203a6.gif",
		desc: "致以无瑕之人",
		siteurl: "https://blog.elykia.cn/",
		tags: [
			"博客"
		]
	},
	{
		id: 3,
		title: "XiaoWangのBlog~",
		imgurl: "https://image.xiaowang233.top/ts.png",
		desc: "「又一个 WordPress 站点」",
		siteurl: "https://blog.xiaowang233.top",
		tags: [
			"博客"
		]
	},
	{
		id: 4,
		title: "羊角快车Blog",
		imgurl: "https://r2page.jiaoblog.dpdns.org/images/aebcb8f461af86e7df331bee79fa5d0953dbaeed.png",
		desc: "发布各种白嫖资源/实用教程",
		siteurl: "https://jiaoblog.dpdns.org/",
		tags: [
			"博客"
		]
	},
	{
		id: 5,
		title: "Inalineの小站",
		imgurl: "https://inaline.net/usr/themes/inaline/assets/images/logo/cover.png",
		desc: "此情可待成追忆，只是当时已惘然",
		siteurl: "https://inaline.net",
		tags: [
			"博客"
		]
	},
	{
		id: 9,
		title: "阿叶Ayeez的小站",
		imgurl: "https://qiniu.ayeez.cn/avatar.jpg",
		desc: "记录学习历程，记录美好生活",
		siteurl: "https://blog.Ayeez.cn",
		tags: [
			"博客"
		]
	},
	{
		id: 10,
		title: "ZY知识库",
		imgurl: "https://blog.pljzy.top/_astro/logo.BxIxyJV1_Z19cEQW.webp",
		desc: "一个技术探索与分享的平台",
		siteurl: "https://blog.pljzy.top/",
		tags: [
			"博客"
		]
	},
	{
		id: 14,
		title: "XingHuiSamaの宝藏之地",
		imgurl: "https://bu.dusays.com/2026/03/24/69c1e38ac1846.jpg",
		desc: "今天我也要学习吗",
		siteurl: "https://www.xinghuisama.top/",
		tags: [
			"博客"
		]
	},
	{
		id: 23,
		title: "fqzlr",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
		desc: "躬身入局，心为主理，行有尺度，自持本心.",
		siteurl: "https://fqzlr.com/",
		tags: [
			"博客"
		]
	},
	{
		id: 24,
		title: "团子和蛋糕",
		imgurl: "https://blog.tsh520.cn/assets/ziyuan/tx.webp",
		desc: "如果你喜欢那么欢迎来到我的世界！",
		siteurl: "https://blog.tsh520.cn",
		tags: [
			"博客"
		]
	},
	{
		title: "合肥一中电脑社",
		imgurl: "https://a.favicon.im/hfyzdns.cn",
		desc: "零基础友好 · 技术驱动的校园科技社团",
		siteurl: "https://hfyzdns.cn",
		tags: [
			"社团"
		],
		id: 16
	},
	{
		title: "UpXuu's blog",
		imgurl: "https://upxuu.com/images/me.jpg",
		desc: "逐光而上",
		siteurl: "https://upxuu.com",
		tags: [
			"博客"
		],
		id: 18
	},
	{
		title: "他说",
		imgurl: "https://090909.top/assets/images/logo.ico",
		desc: "梁栋烨的博客网站。",
		siteurl: "https://090909.top/",
		tags: [
			"博客"
		],
		id: 19
	},
	{
		title: "Innei",
		imgurl: "https://avatars.githubusercontent.com/u/41265413?v=5",
		desc: "Innei's personal blog on frontend and full-stack development — TypeScript, React, Next.js, AI engineering, indie hacking, travel and life.",
		siteurl: "https://innei.in/",
		tags: [
			"博客",
			"优质"
		],
		id: 20
	},
	{
		title: "Meet Blog 博客星图 ",
		imgurl: "https://a.favicon.im/meet-blog.buyixiao.xyz",
		desc: "中文独立博客星系",
		siteurl: "https://meet-blog.buyixiao.xyz/",
		tags: [
			"博客园"
		],
		id: 21
	},
	{
		title: "MmzMing的知识库",
		imgurl: "https://i.stardots.io/784774835/StarDots-2026052116374135506.jpg",
		desc: "哈基米，南北绿豆",
		siteurl: "https://tblog.mmzhiku.xyz",
		tags: [
			"博客"
		],
		id: 22
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
