// 友情链接数据配置
// 用于管理友情链接页面的数据
import type { FriendItem } from "../types/friends";
const friendsData: FriendItem[] = [
	{
		id: 1,
		title: "Mizuki Docs",
		imgurl:
			"https://q.qlogo.cn/headimg_dl?dst_uin=3231515355&spec=640&img_type=jpg",
		desc: "Mizuki User Manual",
		siteurl: "https://docs.mizuki.mysqil.com",
		tags: ["技术"],
	},
	{
		id: 2,
		title: "Vercel",
		imgurl: "https://ts3.tc.mm.bing.net/th/id/OIP-C.BHToo31Gbbw69wyXq4pqBQAAAA?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
		desc: "Develop. Preview. Ship.",
		siteurl: "https://vercel.com",
		tags: ["技术"],
	},
	{
		id: 3,
		title: "GitHub",
		imgurl: "https://tse3-mm.cn.bing.net/th/id/OIP-C.Lwbgu4eSpSz4gKe-F_k58gHaHa?w=167&h=180&c=7&r=0&o=7&pid=1.7&rm=3",
		desc: "Where the world builds software",
		siteurl: "https://github.com",
		tags: ["技术"],
	},
	{
		id: 3,
		title: "合肥一中电脑社",
		imgurl: "https://hfyzdns.cn/logo.png",
		desc: "合肥一中历史最悠久的科技社团之一。 零基础友好 · 技术驱动。从编程入门到 VR 开发，从游戏设计到 AI 实践，打造自由交流、学习、创造的平台。",
		siteurl: "https://hfyzdns.cn",
		tags: ["校园"],
	},
	{
		id: 4,
		title: "CloudFlare ImgBed",
		imgurl: "https://cfbed.sanyue.de/logo.png",
		desc: "开源文件托管解决方案，安心存取，轻松分享",
		siteurl: "https://cfbed.sanyue.de",
		tags: ["技术"],
	},
	{
		id: 5,
		title: "叮叮猫资源搜索站",
		imgurl: "https://www.boosds.cn/uploads/image/20260406/5572e4ad14fa6e2579205aa9048d2429.png",
		desc: "免费分享百万级网盘资源,请输入准确影视名称进行搜索！",
		siteurl: "https://www.boosds.cn",
		tags: ["资源"],
	},
	{
		id: 6,
		title: "Twikoo",
		imgurl: "https://twikoo.js.org/twikoo-logo-home.png",
		desc: "网站评论系统，简洁、安全、免费",
		siteurl: "https://twikoo.js.org",
		tags: ["技术"],
	},
	{
		id: 7,
		title: "LX Music",
		imgurl: "https://ts1.tc.mm.bing.net/th/id/OIP-C.pxhC07XCuH4CfENun93MqwAAAA?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
		desc: "一个免费&开源的音乐查找工具",
		siteurl: "https://lxmusic.toside.cn",
		tags: ["资源"],
	},
	{
		id: 8,
		title: "蜜蜂图床",
		imgurl: "https://bee-reg-ab.imagency.cn/p/81985253f7a87ad615ee5ad6fffba283.png",
		desc: "提供免费、稳定、高速的图片上传与外链服务平台",
		siteurl: "https://www.beeimg.cn/",
		tags: ["图床"],
	},
	{
		id: 9,
		title: "Cloudflare",
		imgurl: "https://www.zhanlian.net/wp-content/uploads/2022/10/36e0f-www.cloudflare.com.png",
		desc: "为您的网站提供免费的防护和加速",
		siteurl: "https://dash.cloudflare.com/",
		tags: ["技术"],
	},
	{
		id: 10,
		title: "合肥市第一中学",
		imgurl: "https://tse2-mm.cn.bing.net/th/id/OIP-C.c7j-78QvJc2VrZ-j1t80FAAAAA?w=154&h=155&c=7&r=0&o=7&pid=1.7&rm=3",
		desc: "怀天下抱负，做未来主人。",
		siteurl: "http://www.hfyz.net/sy/index.html",
		tags: ["校园"],
	},
	{
		id: 11,
		title: "PigHub",
		imgurl: "https://www.pighub.top/images/%E7%88%B1%E4%B8%8A%E4%B8%80%E5%8F%AA%E5%B0%8F%E7%8C%AA%EF%BC%9F.jpg",
		desc: "最大的猪猪图片网站",
		siteurl: "https://www.pighub.top/",
		tags: ["娱乐"],
	},
	{
		id: 12,
		title: "Z-Library",
		imgurl: "https://tse3-mm.cn.bing.net/th/id/OIP-C.YrNMwDyCI7RRbq5_NIVNhQAAAA?w=131&h=150&c=7&r=0&o=7&pid=1.7&rm=3",
		desc: "世界上最大的电子图书馆。自由访问知识和文化。",
		siteurl: "https://zh.kid1412.by/",
		tags: ["资源"],
	},
	{
		id: 13,
		title: "GitHub加速",
		imgurl: "https://weavatar.com/avatar/50abbf204520fa0a98fdaab4bc98a10f",
		desc: "将 GitHub 链接转换为多区域加速链接，解决 GitHub 访问慢、下载失败等问题",
		siteurl: "https://gh-proxy.com/",
		tags: ["工具"],
	},
	{
		id: 14,
		title: "YuJing ImgHub",
		imgurl: "https://img.yujingblog.top/file/1785690853054_logo.png",
		desc: "我的个人图床",
		siteurl: "https://img.yujingblog.top",
		tags: ["图床"],
	},
	{
		id: 15,
		title: "哲风壁纸",
		imgurl: "https://haowallpaper.com/favicon.ico",
		desc: "免费4K高清壁纸-电脑背景图片-Mac壁纸网站",
		siteurl: "https://haowallpaper.com/",
		tags: ["图床"],
	},
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
