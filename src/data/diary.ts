// 日记数据配置
// 用于管理日记页面的数据
// 内容分离：此文件由内容仓库同步管理

export interface DiaryItem {
	id: number;
	content: string;
	date: string;
	images?: string[];
	location?: string;
	mood?: string;
	tags?: string[];
	imgMode?: string;
}

// 日记数据
const diaryData: DiaryItem[] = [
	{
		id: 1,
		content: "它老冯的！这个博客写了好几天了。今天终于写到日记了，算鸟，当学MarkDown了。",
		date: "2026-07-26T20:58:00+08:00",
		images: ["https://bee-reg-ab.imagency.cn/p/0579b27512a43f6f5ecdfdd75d363f16.png"],
		location: "家里",
		mood: "崩溃",
		tags: ["博客搭建"],
	},
	{
		id: 2,
		content: "OK呀我也是起床了好吧。",
		date: "2026-07-27T12:39:01+08:00",
		images: [],
		mood: "无语",
		tags: ["日常"],
	},
	{
		id: 3,
		content: "我的token呀!/(ㄒoㄒ)/~~,这复刻个GitHub上的开源项目这么烧token,用了ClawX和CodeX,这个CodeX现在怎么放在Chat GTP里了，没有想象的好用（呃有可能是因为换了模型吧）总之白期待了，我的token啊，早知道不偷懒了，呜呜呜😒",
		date: "2026-07-27T19:06:01+08:00",
		images: ["https://bee-reg-ab.imagency.cn/p/a425b75dcb73d3b23eed6309a5f84ae1.png"],
		mood: "心痛",
		tags: ["博客搭建"],
	},
	{
		id: 4,
		content: "删了小两百个好友，十来天了，还是只有四个人发现，轮存在感这一块👍。",
		date: "2026-07-30T14:38:31+08:00",
		images: ["https://img.yujingblog.top/file/1785928043492_屏幕截图_2026-07-24_152153.webp"],
		mood: "扎心➳♥゛",
		tags: ["碎碎念"],
		imgMode: "mode-mid",
	},
	{
		id: 5,
		content: "都走了安静多了，我好像还能活了😗",
		date: "2026-07-30T20:38:31+08:00",
		images: [],
		mood: "轻松",
		tags: ["碎碎念"],
	},
	{
		id: 6,
		content: "一个人",
		date: "2026-07-31T00:12:05+08:00",
		images: [],
		mood: "轻松",
		tags: ["碎碎念"],
	},
	{
		id: 7,
		content: "谁懂通宵两天写出来的屎山代码都跑不起来，有全滚回到一开始的版本",
		date: "2026-07-31T01:59:05+08:00",
		images: ["https://tse4-mm.cn.bing.net/th/id/OIP-C.FAuf6qKdlov89LMj7PqQJAAAAA?w=170&h=180&c=7&r=0&o=7&pid=1.7&rm=3"],
		mood: "命苦",
		tags: ["博客搭建"],
		imgMode: "mode-grid",
	},
	{
		id: 8,
		content: "买了个lived2d模型，0.15￥呢。原本准备放到博客里，但这个好像是转卖的，算了我支持正版(咳咳！绝对不是因为不会去水印 嗷┗|｀O′|┛~~)",
		date: "2026-08-01T03:59:05+08:00",
		images: ["https://img.yujingblog.top/file/1785786132107_屏幕截图_2026-08-01_185526.webp"],
		mood: "呃(⊙﹏⊙)",
		tags: ["日常"],
		imgMode: "mode-mid",
	},
	{
		id: 9,
		content: "看板娘终于升级好了，喵🐾 ",
		date: "2026-08-02T02:55:05+08:00",
		images: [],
		location: "安徽",
		mood: "舒服",
		tags: ["博客搭建"],
	},
	{
		id: 10,
		content: "想要变成这样，快来留言！",
		date: "2026-08-04T02:58:05+08:00",
		images: ["https://img.yujingblog.top/file/1785781799608_image.webp"],
		mood: "羡慕",
		tags: ["博客搭建"],
	},
	{
		id: 11,
		content: "这次是彻底穿了😴",
		date: "2026-08-05T06:00:00+08:00",
		images: [],
		mood: "疲惫",
		tags: ["日常"],
	},
];

// 获取日记列表（按时间倒序）
export const getDiaryList = (limit?: number) => {
	const sortedData = [...diaryData].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);

	if (limit && limit > 0) {
		return sortedData.slice(0, limit);
	}

	return sortedData;
};

// 获取所有标签
export const getAllTags = () => {
	const tags = new Set<string>();
	for (const item of diaryData) {
		if (item.tags) {
			for (const tag of item.tags) {
				tags.add(tag);
			}
		}
	}
	return Array.from(tags).sort();
};
