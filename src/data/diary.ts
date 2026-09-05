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
		content: "不对呀，这个gemini api key怎么要满18啊，那我不是白注册谷歌账号了吗😓",
		date: "2026-08-27T11:55:25+08:00",
		images: [],
		location: "",
		mood: "无语",
		tags: [
			"碎碎念"
		],
		imgMode: "",
		id: 33
	},
	{
		content: "我靠，终于成了，我有谷歌账号了",
		date: "2026-08-27T10:50:32+08:00",
		images: [
			"https://img.yujingblog.top/file/1787799201489_Screenshot_20260827_104252.jpg"
		],
		location: "",
		mood: "激动",
		tags: [],
		imgMode: "mode-mid",
		id: 32
	},
	{
		content: "我成功在旧手机上跑上了dsh，QQ 机器人，就是好像有点慢",
		date: "2026-08-27T00:00:57+08:00",
		images: [
			"https://img.yujingblog.top/file/1787793557820_Screenshot_20260827_091306.jpg"
		],
		location: "",
		mood: "",
		tags: [],
		imgMode: "mode-mid",
		id: 31
	},
	{
		content: "明晚就要回合肥了，这次来北京又好像啥也没干",
		date: "2026-08-26T21:51:25+08:00",
		images: [],
		location: "北京 丰台",
		mood: "",
		tags: [],
		imgMode: "",
		id: 30
	},
	{
		content: "正在搬运旧博容零星点东西 ing...\n",
		date: "2026-08-25T19:42:14+08:00",
		images: [],
		location: "",
		mood: "",
		tags: [
			"博客搭建"
		],
		imgMode: "",
		id: 29
	},
	{
		content: "王泽，矿大，麻薯饼\n我突然又不相信了😪",
		date: "2026-08-25T17:27:19+08:00",
		images: [],
		location: "门头沟",
		mood: "难受",
		tags: [
			"碎碎念"
		],
		imgMode: "",
		id: 22
	},
	{
		content: "顺为凡，逆为仙。仙逆！\n攒了好多集，直接爽看",
		date: "2026-08-22T21:10:12+08:00",
		images: [
			"https://img.yujingblog.top/file/1787403796712_1040g3k031r84vr9n7okg5n21kcn1ke2jpgkrppo.webp",
			"https://img.yujingblog.top/file/1787403805491_1040g3k831r84vrq8nucg5n21kcn1ke2jfgjr5k8.webp",
			"https://img.yujingblog.top/file/1787403813022_1040g3k831r84vrq8nud05n21kcn1ke2jvb08meo.webp",
			"https://img.yujingblog.top/file/1787403825717_1040g3k031r84vr9n7of05n21kcn1ke2j9sng728.webp",
			"https://img.yujingblog.top/file/1787403823527_1040g3k831r84vrq8nudg5n21kcn1ke2j5tugmv8.webp",
			"https://img.yujingblog.top/file/1787403833742_1040g3k031r84vr9n7oig5n21kcn1ke2jrav72t8.webp",
			"https://img.yujingblog.top/file/1787403849694_1040g3k031r84vr9n7oj05n21kcn1ke2jvuee2vg.webp",
			"https://img.yujingblog.top/file/1787403871249_1040g3k031qljninb7u2g5n2unaekn830be2l5mo.webp",
			"https://img.yujingblog.top/file/1787403876015_1040g3k031qljninb7u305n2unaekn830n7slrg8.webp",
			"https://img.yujingblog.top/file/1787403895740_1040g3k031qljninb7u005n2unaekn8300lsnes8.webp",
			"https://img.yujingblog.top/file/1787403901955_1040g3k031qljninb7u5g5n2unaekn8305avodvo.webp",
			"https://img.yujingblog.top/file/1787403909695_1040g3k031qljninb7u6g5n2unaekn8305ndja0g.webp",
			"https://img.yujingblog.top/file/1787403916613_1040g3k031qljninb7u205n2unaekn830ehhsaeo.webp",
			"https://img.yujingblog.top/file/1787403914289_1040g3k0320oi1hcpm20g4aluobtg7bmh8q5uk28.webp",
			"https://img.yujingblog.top/file/1787403923978_1040g3k031qljninb7u605n2unaekn830fv4fl2o.webp"
		],
		location: "门头沟",
		mood: "爽",
		tags: [
			"日常"
		],
		imgMode: "mode-mid",
		id: 21
	},
	{
		content: "乱逛，累死了",
		date: "2026-08-17T20:46:26+08:00",
		images: [
			"https://img.yujingblog.top/file/1787316011003_IMG_20260817_200046.webp",
			"https://img.yujingblog.top/file/1787316016673_IMG_20260817_195421.webp",
			"https://img.yujingblog.top/file/1787316026777_IMG_20260817_191235.webp",
			"https://img.yujingblog.top/file/1787316023832_IMG_20260817_192444.webp",
			"https://img.yujingblog.top/file/1787316023227_IMG_20260817_200628.webp",
			"https://img.yujingblog.top/file/1787316028896_IMG_20260817_194739.webp",
			"https://img.yujingblog.top/file/1787316029763_IMG_20260817_193649.webp",
			"https://img.yujingblog.top/file/1787316033318_IMG_20260817_151032.webp",
			"https://img.yujingblog.top/file/1787316041611_IMG_20260817_160510.webp",
			"https://img.yujingblog.top/file/1787316043847_IMG_20260817_161526.webp",
			"https://img.yujingblog.top/file/1787316039034_IMG_20260821_180913.webp",
			"https://img.yujingblog.top/file/1787316041585_IMG_20260817_183213.webp"
		],
		location: "北京",
		mood: "累死",
		tags: [
			"日常"
		],
		imgMode: "mode-grid",
		id: 20
	},
	{
		content: "I ‘m back",
		date: "2026-08-13T06:58:01+08:00",
		images: [],
		location: "北京",
		mood: "",
		tags: [
			"日常"
		],
		imgMode: "",
		id: 19
	},
	{
		content: "记录，第一次被攻击，虽然只是储存xxs，我只限输入30字，想着应该拿不到我的Cookie就没事。就今天输密码半天进不去，我还真以为拿到了，一检查才发现是之前误删worker，变量跟着丢了，忘加了😒\n但因为textContent 是空的或和原文不一致，管理员还删不掉，也确实被折腾了😅",
		date: "2026-08-11T15:41:00+08:00",
		images: [
			"https://img.yujingblog.top/file/1786432856824_image.png"
		],
		location: "",
		mood: "震惊",
		tags: [
			"技术"
		],
		imgMode: "mode-fill",
		id: 18
	},
	{
		content: "睡不着ing…",
		date: "2026-08-11T04:29:00+08:00",
		images: [],
		location: "床",
		mood: "无聊",
		tags: [
			"日常"
		],
		imgMode: "",
		id: 17
	},
	{
		content: "依旧，我“起”这么早",
		date: "2026-08-10T05:07:00+08:00",
		images: [],
		location: "",
		mood: "难评",
		tags: [
			"日常"
		],
		imgMode: "",
		id: 16
	},
	{
		content: "AI漫剧误我啊！\n",
		date: "2026-08-09T05:42:00+08:00",
		images: [],
		location: "家",
		mood: "累",
		tags: [
			"日常"
		],
		imgMode: "",
		id: 15
	},
	{
		id: 14,
		content: "666，一直以为是我网站没优化好，没做优选，没用CDN，结果今天用我🐎手机，才发现……\ntm的是设备的问题，还只是14P，秒进3D音乐可视化页面，都不带加载的，我哭死了┭┮﹏┭┮\n原来只是我设备都太烂了……",
		date: "2026-08-08T18:18:00+08:00",
		images: [],
		location: "家",
		mood: "哭死",
		tags: [
			"碎碎念"
		],
		imgMode: ""
	},
	{
		id: 13,
		content: "博客基本已经成熟了",
		date: "2026-08-08T15:28:00+08:00",
		images: [],
		location: "",
		mood: "放松",
		tags: [
			"博客搭建"
		],
		imgMode: ""
	},
	{
		id: 12,
		content: "我无疑是崩溃的",
		date: "2026-08-07T09:58:00+08:00",
		images: [
			"https://img.yujingblog.top/file/1786107895461_image.webp"
		],
		location: "电脑前",
		mood: "崩溃",
		tags: [
			"博客更新"
		],
		imgMode: "mode-grid"
	},
	{
		id: 11,
		content: "这次是彻底穿了😴",
		date: "2026-08-05T06:00:00+08:00",
		images: [],
		mood: "疲惫",
		tags: [
			"日常"
		]
	},
	{
		id: 10,
		content: "想要变成这样，快来留言！",
		date: "2026-08-04T02:58:05+08:00",
		images: [
			"https://img.yujingblog.top/file/1785781799608_image.webp"
		],
		mood: "羡慕",
		tags: [
			"博客搭建"
		]
	},
	{
		id: 9,
		content: "看板娘终于升级好了，喵🐾 ",
		date: "2026-08-02T02:55:05+08:00",
		images: [],
		location: "安徽",
		mood: "舒服",
		tags: [
			"博客搭建"
		]
	},
	{
		id: 8,
		content: "买了个lived2d模型，0.15￥呢。原本准备放到博客里，但这个好像是转卖的，算了我支持正版(咳咳！绝对不是因为不会去水印 嗷┗|｀O′|┛~~)",
		date: "2026-08-01T03:59:05+08:00",
		images: [
			"https://img.yujingblog.top/file/1785786132107_屏幕截图_2026-08-01_185526.webp"
		],
		mood: "呃(⊙﹏⊙)",
		tags: [
			"日常"
		],
		imgMode: "mode-mid"
	},
	{
		id: 7,
		content: "谁懂通宵两天写出来的屎山代码都跑不起来，有全滚回到一开始的版本",
		date: "2026-07-31T01:59:05+08:00",
		images: [
			"https://tse4-mm.cn.bing.net/th/id/OIP-C.FAuf6qKdlov89LMj7PqQJAAAAA?w=170&h=180&c=7&r=0&o=7&pid=1.7&rm=3"
		],
		mood: "命苦",
		tags: [
			"博客搭建"
		],
		imgMode: "mode-grid"
	},
	{
		id: 6,
		content: "一个人",
		date: "2026-07-31T00:12:05+08:00",
		images: [],
		mood: "轻松",
		tags: [
			"碎碎念"
		]
	},
	{
		id: 5,
		content: "都走了安静多了，我好像还能活了😗",
		date: "2026-07-30T20:38:31+08:00",
		images: [],
		mood: "轻松",
		tags: [
			"碎碎念"
		]
	},
	{
		id: 4,
		content: "删了小两百个好友，十来天了，还是只有四个人发现，轮存在感这一块👍。",
		date: "2026-07-30T14:38:31+08:00",
		images: [
			"https://img.yujingblog.top/file/1785928043492_屏幕截图_2026-07-24_152153.webp"
		],
		mood: "扎心➳♥゛",
		tags: [
			"碎碎念"
		],
		imgMode: "mode-mid"
	},
	{
		id: 3,
		content: "我的token呀!/(ㄒoㄒ)/~~,这复刻个GitHub上的开源项目这么烧token,用了ClawX和CodeX,这个CodeX现在怎么放在Chat GTP里了，没有想象的好用（呃有可能是因为换了模型吧）总之白期待了，我的token啊，早知道不偷懒了，呜呜呜😒",
		date: "2026-07-27T19:06:01+08:00",
		images: [
			"https://bee-reg-ab.imagency.cn/p/a425b75dcb73d3b23eed6309a5f84ae1.png"
		],
		mood: "心痛",
		tags: [
			"博客搭建"
		]
	},
	{
		id: 2,
		content: "OK呀我也是起床了好吧。",
		date: "2026-07-27T12:39:01+08:00",
		images: [],
		mood: "无语",
		tags: [
			"日常"
		]
	},
	{
		id: 1,
		content: "它老冯的！这个博客写了好几天了。今天终于写到日记了，算鸟，当学MarkDown了。",
		date: "2026-07-26T20:58:00+08:00",
		images: [
			"https://bee-reg-ab.imagency.cn/p/0579b27512a43f6f5ecdfdd75d363f16.png"
		],
		location: "家里",
		mood: "崩溃",
		tags: [
			"博客搭建"
		]
	},
	{
		content: "改上网课了",
		date: "2026-07-24T18:38:40+08:00",
		images: [
			"https://bee-reg-ab.imagency.cn/p/598a6f97f1649fd4566de8310eb8de3e.png"
		],
		location: "",
		mood: "",
		tags: [
			"日常"
		],
		imgMode: "mode-fill",
		id: 28
	},
	{
		content: "不想放假，不行我就要全住宿",
		date: "2026-07-24T12:33:40+08:00",
		images: [
			"https://img.yujingblog.top/file/1785762074762_0ACA8D332B2B6287AB9DD9054C4BA9A8.webp"
		],
		location: "",
		mood: "",
		tags: [
			"碎碎念"
		],
		imgMode: "",
		id: 26
	},
	{
		content: "《爱上她的理由》已看完，一眼万年李诗雅\n第二季怎么还没开始更啊，急！",
		date: "2026-07-23T23:15:23+08:00",
		images: [
			"https://img.yujingblog.top/file/1787653083252_1fe04f7ac95b638dbdad86c0cbeb14d6.webp"
		],
		location: "",
		mood: "",
		tags: [],
		imgMode: "mode-fill",
		id: 25
	},
	{
		content: "我有域名了yujingblog.top\n阿里云14元买的",
		date: "2026-07-23T20:58:00+08:00",
		images: [],
		location: "安徽 合肥",
		mood: "激动",
		tags: [
			"博客搭建"
		],
		imgMode: "",
		id: 23
	},
	{
		content: "今天早晨才下定决心重新建站，上个版本同步源码有问题。看来我赌对了，这个版本同步很成功！准备接下来把评论系统，AI，图床搞好。",
		date: "2026-07-23T17:58:26+08:00",
		images: [],
		location: "",
		mood: "",
		tags: [
			"博客搭建"
		],
		imgMode: "",
		id: 24
	},
	{
		content: "https://codebuddy.work/agents/share/9_NWSVBN_4a19ds0e2Gk50h99whj6orxTJdrHeL7gAlZ6MHGupe1RJmhc-H4z2bl?platform=codebuddy",
		date: "2026-08-27T19:26:09+08:00",
		images: [],
		location: "",
		mood: "",
		tags: [],
		imgMode: "",
		id: 34
	}
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
