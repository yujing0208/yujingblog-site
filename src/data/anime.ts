// 本地番剧数据配置
export interface AnimeItem {
	title: string;
	status: "watching" | "completed" | "planned" | "onhold" | "dropped";
	category: "anime" | "novel" | "game";
	rating?: number;
	cover: string;
	description: string;
	episodes: string;
	year: string;
	genre: string[];
	studio: string;
	link: string;
	progress?: number | string;
	totalEpisodes?: number | string;
}

const localAnimeList: AnimeItem[] = [
	{
		title: "四月是你的谎言",
		status: "completed",
		category: "anime",
		rating: 9.8,
		cover: "https://i1.hdslb.com/bfs/bangumi/image/ec912249f5bf1fe1521c9a2df5ae655567bd85ef.png@660w_884h.webp",
		description: "从小接受母亲严格的钢琴训练并在各种音乐比赛上获胜的「神童」—有马公生,11岁那年因母亲去世,他从此变得听不见钢琴的声音，因而放弃了弹奏钢琴。国中三年级时，在青梅竹马泽村椿的引见下，公生认识了与他同年级的小提琴手—宫园新，并于一场比赛中被新自由奔放的演奏风格所吸引。自此，公生的日常生活开始有了改变。",
		episodes: "22 episodes",
		year: "2014",
		genre: [
			"音乐",
			"校园",
			"纯爱",
			"治郁"
		],
		studio: "A-1 Pictures",
		link: "https://www.bilibili.com/bangumi/media/md1699",
		progress: 22,
		totalEpisodes: 22
	},
	{
		title: "强风吹拂",
		status: "completed",
		category: "anime",
		rating: 9.9,
		cover: "https://i0.hdslb.com/bfs/bangumi/fe356b227e0005454ab2c267c9d7de902eebe837.png@450w_600h.webp",
		description: "夜晚。如同逃跑一般奔驰在城市中的藏原走。他的侧面，突然有辆自行车冲来。素不相识的男子，对阿走发问了。“喂！你很喜欢跑步吧！”男子的名字是清濑灰二。 就这样,阿走在灰二的引导下,到达了名为竹青庄的老旧公寓。9名个性丰富的住民住在那里。阿走来到最后的空房间,虽然感到困惑,却仍然被强行留下。他怎么也没有想到,自己会成为这里的“第10个男人”……。",
		episodes: "23 episodes",
		year: "2018",
		genre: [
			"运动",
			"励志",
			"热血"
		],
		studio: "Production I.G",
		link: "https://www.bilibili.com/bangumi/media/md139352",
		progress: 23,
		totalEpisodes: 23
	},
	{
		title: "邻家的天使同学 ",
		status: "completed",
		category: "anime",
		rating: 7.3,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/50f011dc86acb0f89bfb38384f9383a68a06bd78.png@450w_600h.webp",
		description: "高一学生藤宫周在升学后开始了他的独居生活。他所在的公寓隔壁，住着他们学校第一的美少女——椎名真昼。他们二人平时几乎没有交集。而一次大雨中，周把伞借给了浑身湿透的真昼。自此，二人便开始了奇妙的交流。周的懒散独居生活让真昼实在看不下去。她便开始为他做饭，打扫卫生，照顾他的起居。互为邻居的二人渐渐地开始对彼此有所了解。这是一个与可爱邻居之间的甜蜜又让人心急的恋爱故事——",
		episodes: "12 episodes",
		year: "2023",
		genre: [
			"日常",
			"校园",
			"纯爱",
			"治愈"
		],
		studio: "project No.9",
		link: "https://www.bilibili.com/bangumi/media/md20136738",
		progress: 12,
		totalEpisodes: 12
	},
	{
		title: "爱上她的理由",
		status: "completed",
		category: "anime",
		rating: 8.8,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/c852e87648ff8de5ea6c279c7bc772368f44f542.png@450w_600h.webp",
		description: "大一新生袁君瑭为了接近暗恋已久的学姐朱茱报考了闵松大学。入学后，在学校里意外认识休学的前偶像兼学姐李诗雅，在校园内与学姐朱茱再会，又在联谊晚会上相识到学姐崔若霓。随后袁君瑭陷入与三个女生的感情漩涡之中，彷徨纠结…",
		episodes: "22 episodes",
		year: "2023",
		genre: [
			"青春",
			"校园",
			"恋爱"
		],
		studio: "绘之刃",
		link: "https://www.bilibili.com/bangumi/media/md28339917",
		progress: 22,
		totalEpisodes: 22
	},
	{
		title: "天气之子",
		status: "completed",
		category: "anime",
		rating: 9.6,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/33680a2209c4dba76322b2ffeeaf3dd821db576c.png@450w_600h.webp",
		description: "高一那年夏天，帆高（醍醐虎汰朗 配音）离开位在离岛的家乡，独自一人来到东京，拮据的生活迫使他不得不找份工作，最后来到一间专门出版奇怪超自然刊物的出版社担任写手。不久，东京开始下起连日大雨，仿佛暗示着帆高不顺遂的未来，在这座繁忙城市里到处取材的帆高邂逅了与弟弟相依为命，不可思议的美少女阳菜（森七菜 配音）。「等等就会放晴了喔。」阳菜这样告诉着帆高，不久，头顶的乌云逐渐散去，耀眼的阳光洒落街道……原来，阳菜拥有「改变天气」的奇妙能力……",
		episodes: "1 episodes",
		year: "2019",
		genre: [
			"爱情",
			"奇幻",
			"电影"
		],
		studio: "CoMix Wave Films",
		link: "https://www.bilibili.com/bangumi/media/md28339917",
		progress: 1,
		totalEpisodes: 1
	},
	{
		title: "你的名字",
		status: "completed",
		category: "anime",
		rating: 9.9,
		cover: "https://vfiles.gtimg.cn/wuji_dashboard/xy/starter/%E4%BD%A0%E7%9A%84%E5%90%8D%E5%AD%973.png?imageView2/2/w/163/h/227",
		description: "在远离大都会的小山村，住着巫女世家出身的高中女孩宫水三叶（上白石萌音 配音）。校园和家庭的原因本就让她充满烦恼，而近一段时间发生的奇怪事件，又让三叶摸不清头脑。不知从何时起，三叶在梦中就会变成一个住在东京的高中男孩。那里有陌生的同学和朋友，有亲切的前辈和繁华的街道，一切都是如此诱人而真实。另一方面，住在东京的高中男孩立花泷（神木隆之介 配音）则总在梦里来到陌生的小山村，以女孩子的身份过着全新的生活。许是受那颗神秘彗星的影响，立花和三叶在梦中交换了身份。他们以他者的角度体验着对方的人生，这期间有愤怒、有欢笑也有暖心。只是两人并不知道，身份交换的背后隐藏着重大而锥心的秘密……",
		episodes: "1 episodes",
		year: "2016",
		genre: [
			"爱情",
			"奇幻",
			"电影"
		],
		studio: "CoMix Wave Film",
		link: "https://v.qq.com/x/search/?q=%E4%BD%A0%E7%9A%84%E5%90%8D%E5%AD%97%E3%80%82",
		progress: 1,
		totalEpisodes: 1
	},
	{
		title: "铃芽之旅",
		status: "completed",
		category: "anime",
		rating: 9.8,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/53a57fd0999f6c00e19b1d9a52c74e410e0dee9c.png@450w_600h.webp",
		description: "故事讲述生活在日本九州田舍的17岁少女・铃芽遇见了为了寻找“门”而踏上旅途的青年。追随着青年的脚步,铃芽来到了山上一片废墟之地，在这里静静伫立着一扇古老的门，仿佛是坍塌中存留的唯一遗迹。铃芽仿佛被什么吸引了一般，将手伸向了那扇门…不久之后，日本各地的门开始一扇一扇地打开。据说，开着的门必须关上，否则灾祸将会从门的那一边降临于现世。",
		episodes: "1 episodes",
		year: "2023",
		genre: [
			"爱情",
			"奇幻",
			"电影"
		],
		studio: "CoMix Wave Films",
		link: "https://www.bilibili.com/bangumi/media/md28370944",
		progress: 1,
		totalEpisodes: 1
	},
	{
		title: "言叶之庭",
		status: "completed",
		category: "anime",
		rating: 9.7,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/5b00c25e00b639194f51ead01c557c9709c3ea6a.jpg@450w_600h.webp",
		description: "刚满15岁的高中生秋月孝雄,因母亲离家出走,不得不为了生计打工赚钱。入梅之日,孝雄逃课来到一座日本庭园。安静的小亭子里,27岁的职场女性雪野百香里边吃巧克力、边喝啤酒的样子引起了他的注意。对彼此感到似曾相识的二人,每到落雨之日便从世俗的烦恼中逃脱出来，相会于这座都市丛林中的幽静角落。在梅雨季节，他们的心渐渐互相靠拢。志愿成为手工鞋匠的秋月，决心为雪野做一双鞋。雨过天晴，艳阳高照，庭园中久久不见两人的身影……",
		episodes: "1 episodes",
		year: "2013",
		genre: [
			"日常",
			"治愈",
			"电影"
		],
		studio: "CoMix Wave Films",
		link: "https://www.bilibili.com/bangumi/media/md2546",
		progress: 1,
		totalEpisodes: 1
	},
	{
		title: "秒速五厘米",
		status: "onhold",
		category: "anime",
		rating: 9.6,
		cover: "https://vcover-vt-pic.puui.qpic.cn/vcover_vt_pic/0/sdp0011n60epnph1748678624/260?imageView2/2/w/163/h/227",
		description: "如果,樱花掉落的速度是每秒5厘米,那么两颗心需要多久才能靠近?少年时，贵树（水桥研二 配音）和明理（近藤好美 配音）是形影不离的好朋友，可很快，一道巨大的鸿沟便横亘在两人中间：明理转学，贵树也随着父母工作的调动搬到遥远的鹿儿岛。在搬家前，贵树乘坐新干线千里迢迢和明理相会，在漫 长的等待后,茫茫大雪中,两人在枯萎的樱花树下深情相拥,并献出彼此的first kiss,约定着下一次再一起来看樱花。时光荏苒,两人竟再没见过,虽然在人海中一直搜寻彼此的身影,但似乎总是徒然。再后来,他们分别有了各自的生活,只是还偶尔会梦到13岁时的这段青涩而美好的感情,才明白当年怎么也说不出口的那个字就是爱。",
		episodes: "1 episodes",
		year: "2007",
		genre: [
			"爱情",
			"电影"
		],
		studio: "CoMix Wave Films",
		link: "https://v.qq.com/x/search/?q=%E7%A7%92%E9%80%9F%E4%BA%94%E5%8E%98%E7%B1%B3%E3%80%82",
		progress: 2,
		totalEpisodes: 3
	},
	{
		title: "我想吃掉你的胰脏",
		status: "completed",
		category: "anime",
		rating: 9.5,
		cover: "https://img9.doubanio.com/view/photo/m/public/p2542584155.webp",
		description: "“没有名字的我，没有未来的她”对他人毫无兴趣，总是独自一人读书的高中生“我”。这样的“我”有一天，偶然捡到一册写着《共病文库》的文库本。那是，天真烂漫的班上人气王·山内樱良私下记录的日记本。里面记载着她身患胰脏的疾病，已经时日无多……。隐藏自己的疾病度过日常的樱良，与知晓其秘密的“我”。——两人的距离，还没有名字。",
		episodes: "1 episodes",
		year: "2016",
		genre: [
			"爱情",
			"电影"
		],
		studio: "CoMix Wave Film",
		link: "",
		progress: 1,
		totalEpisodes: 1
	},
	{
		title: "龙族第1季",
		status: "completed",
		category: "anime",
		rating: 8.7,
		cover: "https://puui.qpic.cn/vcover_vt_pic/0/mzc00200fr1ry1o1656480935127/260?imageView2/2/w/167",
		description: "欢迎来到真实的世界！这一段拥有龙的历史，这里记载了一代代人的努力和牺牲。少年踏上属于他的成王之路，友情、爱情、成长……",
		episodes: "17 episodes",
		year: "2022",
		genre: [
			"奇幻",
			"冒险",
			"国漫"
		],
		studio: "洛水花原",
		link: "https://v.qq.com/x/search/?q=%E9%BE%99%E6%97%8F+%E7%AC%AC1%E5%AD%A3",
		progress: 17,
		totalEpisodes: 17
	},
	{
		title: "龙族第2季",
		status: "completed",
		category: "anime",
		rating: 9,
		cover: "https://vcover-vt-pic.puui.qpic.cn/vcover_vt_pic/0/mzc002008260hny1756439343350/260?imageView2/2/w/163/h/227",
		description: "主角路明非在暑假期间,被学院派遣与师兄楚子航一起执行SS级任务。在回学校的路途中,邂逅了漂亮学妹夏弥。不详的暴雨，悄然落下，带来了⼤地与⼭之王的苏醒消息……少年们该何去何从?",
		episodes: "24 episodes",
		year: "2022",
		genre: [
			"奇幻",
			"冒险",
			"国漫"
		],
		studio: "洛水花原",
		link: "https://v.qq.com/x/search/?q=%E9%BE%99%E6%97%8F+%E7%AC%AC2%E5%AD%A3",
		progress: 24,
		totalEpisodes: 24
	},
	{
		title: "仙逆",
		status: "watching",
		category: "anime",
		rating: 9.4,
		cover: "https://vcover-vt-pic.puui.qpic.cn/vcover_vt_pic/0/mzc00200aaogpgh1766914172519/260?imageView2/2/w/167/h/233",
		description: "改编自耳根同名小说《仙逆》，讲述了乡村平凡少年王林以心中之感动，逆仙而修，求的不仅是长生，更多的是摆脱那背后的蝼蚁之身。他坚信道在人为，以平庸的资质踏入修真仙途，历经坎坷风雨，凭着其聪睿的心智，一步一步走向巅峰，凭一己之力，扬名修真界。",
		episodes: "180 episodes",
		year: "2023",
		genre: [
			"东方玄幻",
			"国漫"
		],
		studio: "铸梦动画",
		link: "https://v.qq.com/x/search/?q=%E4%BB%99%E9%80%86",
		progress: 108,
		totalEpisodes: 180
	},
	{
		title: "吞噬星空​",
		status: "onhold",
		category: "anime",
		rating: 9.4,
		cover: "https://vcover-vt-pic.puui.qpic.cn/vcover_vt_pic/0/324olz7ilvo2j5f1781926278904/260?imageView2/2/w/167/h/233",
		description: "某一天,地球上出现了不明来由的RR病毒,将世界卷入灾难之中。受到感染的动物变异成为可怕的怪兽，大举入侵，人类面临毁灭之际筑起了围墙，成立基地市作为人类最后的堡垒。人类在这一段时间经历的磨难，被称为“大涅槃时期”。在极端的生存环境下，人类的体能也在逐渐地进步发展，尚武之风兴起，人类的身体素质相比以前有了质的飞越。而这其中的佼佼者，被称为“武者”。 18岁的罗峰也梦想着成为其中的一员。此时的他即将高考,正面临着人生十字路口的抉择，却不料怪兽的一次袭击影响了他的人生轨迹。在强大怪兽的威胁之下，市内居民面临危险，军方却束手无策。唯有一名武者挺身而出，保卫了基地市的安全。罗峰被武者的强大所感染，暗自立下成为武者以保护所爱之人的决心。这是一切的开始，罗峰武者之路的起点，也拉开了他传奇人生的序幕。 罗峰立志成为武者，前路却并不平坦，他首先要面对的便是外部环境无形中对他施加的影响。罗峰家庭条件不佳，生活拮据，父母无法给予他更多帮助，只能依靠自己的努力。最终，在不断的艰苦磨砺下，罗峰不断发掘自身潜能，得到了能力提升和自我价值的认可。不仅如此，罗峰不仅扛起了供养家庭的重担，还为了守护人类家园、为了人类更好的生存与发展，与其他正义的武者们一起，联手对付凶恶怪兽。在末日绝境之下，罗峰与其他武者们能否击退怪兽、成功守护人类世界？",
		episodes: "260 episodes",
		year: "2020",
		genre: [
			"未来科幻",
			"国漫"
		],
		studio: "玄机科技",
		link: "https://v.qq.com/x/search/?q=%E5%90%9E%E5%99%AC%E6%98%9F%E7%A9%BA",
		progress: 130,
		totalEpisodes: 260
	},
	{
		title: "神印王座​",
		status: "onhold",
		category: "anime",
		rating: 9,
		cover: "https://vcover-vt-pic.puui.qpic.cn/vcover_vt_pic/0/mzc002007j7p5hn1776850944831/260?imageView2/2/w/167/h/233",
		description: "六千年前，魔神皇枫秀与七十二根魔神柱从天而降，所有生物沾染魔神柱散发的气息，立刻会变异成魔族生物，人类随之进入黑暗年代。随后，人类强者自行组织六大圣殿，阻挡魔族前进的脚步，逐渐形成人魔共存的局面。 主角龙皓晨,为救母加入六大圣殿之一的骑士圣殿,成为一名骑士在一步步成长冒险中,奇遇,诡计,命运般的爱情与友情不断在他身上上演。龙皓晨坚守骑士精神,通过自己的人格与努力,赢得他人认可。他先是与六大圣殿其他天才少年组成“1号猎魔团”对抗魔族,为人类的生存与尊严奋战。同时不惜献出生命，守护自己的伙伴与最珍贵的爱人。而世界的局势变化难测，更多的阴谋在酝酿，更深的秘密也等着他去揭开。 而最终龙皓晨是否能赢得神印王座的认可，登上骑士圣殿的最高荣耀，同时他又是否能面对所有真相揭开的那一刻，化解整个世界最大的危机，一切都有待揭晓。",
		episodes: "208 episodes",
		year: "2022",
		genre: [
			"奇幻冒险",
			"玄幻修真",
			"国漫"
		],
		studio: "神漫文化",
		link: "https://v.qq.com/x/search/?q=%E7%A5%9E%E5%8D%B0%E7%8E%8B%E5%BA%A7",
		progress: 120,
		totalEpisodes: 208
	},
	{
		title: "不时用俄语小声说真心话的邻桌艾莉同学​",
		status: "planned",
		category: "anime",
		rating: 7.8,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/96f9aeb74c9646c318f25bba798462061bd800d7.png@450w_600h.webp",
		description: "坐在久世政近邻桌的艾莉同学，看政近的目光总是很冷淡。然而她又时不时地用俄语向他表露心意……而这些话语从未被政近错过。原来，政近其实有着母语级别的俄语听力！！艾莉同学对此一无所知，时不时地说着真心话。政近明明能听懂她的心意，却要装作听不懂。令人止不住嘴角上扬的恋爱故事究竟会如何发展？！。",
		episodes: "12 episodes",
		year: "2024",
		genre: [
			"日常",
			"校园",
			"恋爱"
		],
		studio: "动画工房",
		link: "https://www.bilibili.com/bangumi/media/md22053031",
		progress: 12,
		totalEpisodes: 12
	},
	{
		title: "爱上她的理由第二季",
		status: "planned",
		category: "anime",
		rating: 10,
		cover: "https://i1.hdslb.com/bfs/bangumi/image/7274ee43227482787af237a5c7897363ded01602.png@660w_884h.webp",
		description: "袁君瑭与李诗雅牵手成功，开启了所有人憧憬的梦幻校园恋。然而，当甜蜜的滤镜渐渐褪去，自卑、迷茫与成长的阵痛也如期而至。当炙热的爱意撞上现实的梦想，他们在妥协与并肩之间拉扯，这段青春交响曲也终将迎来最后的抉择。",
		episodes: "22 episodes",
		year: "2026?",
		genre: [
			"青春",
			"校园",
			"恋爱"
		],
		studio: "绘之刃",
		link: "https://www.bilibili.com/bangumi/media/md420613337",
		progress: 0,
		totalEpisodes: 22
	},
	{
		title: "魔女之旅",
		status: "completed",
		category: "anime",
		rating: 9.7,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/09533e0b510630235326a818adabb6c64c1abce2.png@450w_600h.webp",
		description: "某个地方有一位旅人，她的名字是伊蕾娜。是一位年纪轻轻就成了魔法使中最上位「魔女」的天才。因为向往着幼时读过的旅行故事，随意地进行着漫长的旅行。在这个广阔的世界里自由地漫步，接触着形形色色有趣的人，体味着人们美好的日常生活，她作为一名旅人，不带有任何目的地接触着各种国家的各色人群。还有同样数量的——「不必理会我。我只是一介旅人罢了。接下来还得继续前往下一个地方呢。」由魔女伊蕾娜所连接的，关于相遇和离别的故事……。",
		episodes: "12",
		year: "2020",
		genre: [
			"小说改",
			"魔法",
			"奇幻",
			"架空"
		],
		studio: "魔女之旅制作委员会",
		link: "https://www.bilibili.com/bangumi/media/md28229881",
		progress: 12,
		totalEpisodes: 12
	},
	{
		title: "龙族",
		status: "completed",
		category: "novel",
		rating: 7.7,
		cover: "https://ts1.tc.mm.bing.net/th/id/OIP-C.v4LIxXNz8XZ9wtzwosskSQHaKR?w=193&h=268&c=8&rs=1&qlt=90&o=6&pid=ImgAns&rm=2",
		description: "他以为他将这样度过一生，他以为他始终只是个衰小孩。但是，一封来自卡塞尔学院的录取通知书改变了他的一生。云层里透出神秘的吟唱：你也有神奇的父母，你也有热血的同伴，你的血管里流动着龙族的血液。而你的目标将是 —— 屠龙。",
		episodes: "5 episodes",
		year: "2010",
		genre: [
			"奇幻",
			"青春伤感"
		],
		studio: "江南",
		link: "",
		progress: 4,
		totalEpisodes: 5
	},
	{
		title: "电锯人",
		status: "completed",
		category: "anime",
		rating: 9.2,
		cover: "https://imgcn.bgmbk.tv/file/bk/75/2f4bf90332ea8c7a21dab9ef276fcaf0.webp?t=26537497608339368&k=1874724684103845",
		description: "电次是一位年轻的恶魔猎人，为了偿还父亲在黑帮处的债务，他与“电锯恶魔”波奇塔一起斩杀低阶恶魔谋生，每天过着贫困的生活。遭遇黑帮债主背叛被杀后，电次在恍惚中与波奇塔缔结契约，拥有了恶魔的心脏，变身成为“电锯人”重生于世。",
		episodes: "12",
		year: "2022",
		genre: [
			"奇幻",
			"战斗",
			"漫改"
		],
		studio: "MAPPA",
		link: "https://chainsawman.dog/",
		progress: 12,
		totalEpisodes: 12
	},
	{
		title: "和平精英",
		status: "onhold",
		category: "game",
		rating: 0,
		cover: "https://tse2-mm.cn.bing.net/th/id/OIP-C.iMXnlHI7l1uaC7tZ4efMuwAAAA?w=153&h=180&c=7&r=0&o=7&pid=1.7&rm=3",
		description: "",
		episodes: "",
		year: "",
		genre: [],
		studio: "",
		link: "https://gp.qq.com/main.shtml",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "名侦探柯南",
		status: "watching",
		category: "anime",
		rating: 9.4,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/38e2a273f528fd01c34f1fc4df0f69c64487efad.png@450w_600h.webp",
		description: "主角工藤新一原本是一位颇具名声的高中生侦探，在目击黑暗组织的地下交易后，正准备追踪时却被突袭击昏，并被灌下代号为“APTX4869”的不明药物。后来虽然幸免于死，但身体就此缩小为小学时期的模样。之后他化名为江户川柯南，在邻居阿笠博士的建议下，寄住在女友毛利兰的父亲—侦探毛利小五郎家中，继续秘密从事追查黑暗组织的工作，并私下探寻获得解药的管道，希望能够恢复原来新一的样貌。与此同时，柯南凭着自己的推理天份，配合阿笠博士为他发明的道具，帮助毛利小五郎成为出名的大侦探。故事内容当中穿插许多爱情、友情、犯罪、背叛、复仇等情节。",
		episodes: "1269+",
		year: "1996",
		genre: [
			"漫画改",
			"推理",
			"智斗",
			"悬疑"
		],
		studio: "青山刚昌",
		link: "https://www.bilibili.com/bangumi/media/md28228775",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "怪盗基德1412",
		status: "completed",
		category: "anime",
		rating: 9.8,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/a8297ae2b0099cfc287b321a4ef99cd3855f299e.png@450w_600h.webp",
		description: "喜欢魔术的高中生黑羽快斗。父亲是天才魔术师，但也有世界大盗怪盗基德这一不为人知的一面。然而，他的父亲因魔术中的意外事故而去世了。自那8年后，快斗意外得知了父亲背后的一面，怀疑他非因事故而死，而是被什么人所杀害的。为了解除这个疑惑，快斗身着礼帽和白色斗篷，继承了父亲的轨迹，成为了怪盗基德。",
		episodes: "24",
		year: "2014",
		genre: [
			"漫画改",
			"智斗",
			"奇幻"
		],
		studio: "青山刚昌",
		link: "https://www.bilibili.com/bangumi/media/md28228781",
		progress: 24,
		totalEpisodes: 24
	},
	{
		title: "间谍过家家",
		status: "completed",
		category: "anime",
		rating: 9.7,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/a524567f86ec21368731f6dc283f66bd1bd0af92.png@450w_600h.webp",
		description: "每个人都有不可告人的一面。这是一个世界各国均暗地里进行激烈情报战的时代。奥斯塔尼亚（Ostania）与维斯达利斯（Westalis）的冷战状态已经持续数十年。<黄昏>是维斯达利斯情报局奥斯塔尼亚对策科<WISE>的一名优秀间谍。为调查威胁两国和平的人物——奥斯塔尼亚国家统一党总裁多诺万·德斯蒙，上级给予了他一个绝密任务。任务名为：<枭（Strix）>行动。内容是“一周之内组建家庭，潜入德斯蒙儿子就读的名门学校的联谊会”。于是<黄昏>扮演成精神科医生劳埃德·福杰，开始组建家庭。然而，他找来的女儿阿尼亚是个能读心的超能力者，妻子约尔是个杀手！三人利害关系一致，便互相隐瞒身份，开始了共同生活。世界的和平，就掌握在这意外不断的临时一家人手中。",
		episodes: "37",
		year: "2022",
		genre: [
			"漫画改",
			"日常",
			"搞笑"
		],
		studio: "WIT STUDIO×CloverWorks",
		link: "https://www.bilibili.com/bangumi/media/md21086686",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "紫罗兰永恒花园 ",
		status: "completed",
		category: "anime",
		rating: 9.8,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/6565f297b31fb4a4a0337557033426930c3b88c0.png@450w_600h.webp",
		description: "某个大陆的、某个时代。大陆南北分割的战争结束了，世界走向了和平。在战争中作为军人的薇尔莉特•伊芙加登，怀抱着对她来说无比重要之人留下的“话语”，离开军队来到了大港口城市。踊跃的人群在排列着煤气灯的街道马路上来来往往地穿梭着。薇尔莉特在街道上找到了“代写书信”的工作。那是根据委托人的想法来组织出相应语言的工作。她直面委托人、触碰着他们内心深处的坦率感情。与此同时，薇尔莉特在记录书信时，渐渐明白那“话语”的含义。",
		episodes: "2018",
		year: "13",
		genre: [
			"治愈",
			"励志",
			"职场",
			"催泪"
		],
		studio: "京都アニメーション",
		link: "https://www.bilibili.com/bangumi/media/md8892",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "冰菓 ",
		status: "completed",
		category: "anime",
		rating: 9.8,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/f623059d4e370a5b09a7c27b5a035895b40d18f8.png@450w_600h.webp",
		description: "在众多将要展开「玫瑰色」生活的高中生之中，本作的男主角折木奉太郎却是一个「灰色」的节能主义者。凡是没必要的事就不做，因为不想后悔，被人说是疏离、厌世也无所谓，因为这就是他的作风。这样的折木奉太郎，却因为姐姐的命令而进入了濒临废社的「古籍研究社」。研究社虽然好不容易招到了四名新社员，但却又卷入了四十五年前社长突然肄业的谜团之中。社长当年留下的名为「冰菓」的社刊，内里究竟隐藏了什么神秘的讯息呢……",
		episodes: "22",
		year: "2012",
		genre: [
			"推理",
			"恋爱",
			"日常",
			"校园"
		],
		studio: "京都动画",
		link: "https://www.bilibili.com/bangumi/media/md3398",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "辉夜大小姐想让我告白 ",
		status: "dropped",
		category: "anime",
		rating: 9.5,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/ffe6ebdf6770e7975bf830bee73a03c79e81b690.png@450w_600h.webp",
		description: "秀知院学园是秀才云集的菁英学校，在学生会中担任学生会副会长·四宫辉夜遇见了学生会长·白银御行。原以为这两个任谁都觉得很登对的天才应该很快就会在一起，但这两人却因为过高的自尊心导致他们终没能向对方告白。“该用什么办法才能让对方向自己告白呢？”在这场恋爱头脑战中用尽各种智慧谋略、身经百战的两人，各自在心中下了某个决心。在秀知院学园高中部的文化祭“奉心祭”的最终日到来前，两人的恋情将会出现巨大的进展。",
		episodes: "",
		year: "2019",
		genre: [
			"漫画改",
			"搞笑",
			"恋爱",
			"校园"
		],
		studio: "A-1 Pictures",
		link: "https://www.bilibili.com/bangumi/media/md28237120",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "青春猪头少年不会梦到兔女郎学姐",
		status: "completed",
		category: "anime",
		rating: 9.8,
		cover: "https://i0.hdslb.com/bfs/bangumi/1cc333ff578e5ea9fded7e454953a4e2291440c2.png@450w_600h.webp",
		description: "青春期症候群——这是一种只发生在易敏感和不稳定的青春期的、不可思议的现象。例如，在梓川咲太面前出现的野生兔女郎。她的真实身份是高中高年级学生，明星活动休止的女演员樱岛麻衣。她迷人的身姿，不知为何在周围的人眼里看不出来。咲太决定解开这一谜题。在与麻衣一起度过的时间里，咲太知道了她秘密的想法……女主人公们一个接一个地出现在咲太的周围，她们都有着“青春期症候群”。在天空和大海都很闪耀的小镇上，开始了令人激动的故事。",
		episodes: "13",
		year: "2018",
		genre: [
			"小说改",
			"恋爱",
			"奇幻",
			"校园"
		],
		studio: "A-1 Pictures",
		link: "https://www.bilibili.com/bangumi/media/md134932",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "我在精神病院学斩神",
		status: "completed",
		category: "novel",
		rating: 9.9,
		cover: "https://p6-novel-sign.byteimg.com/novel-pic/c5397e4a514736bb1c6754663dbee3db~tplv-resize:225:300.image?lk3s=191c1ecc&x-expires=1786249829&x-signature=KVJgx6MzQ5Dpta7rIeD1cBRRXyc%3D",
		description: "你是否想过，在那高悬于世人头顶的月亮之上，伫立着守望人间的神明？ 你是否想过，在人潮汹涌的现代城市之中，存在代替神明行走人间的超凡之人？ 人类统治的社会中，潜伏着无数诡异； 在那些无人问津的生命禁区，居住着古老的神明。 而属于大夏的神明，究竟去了何处？ 在",
		episodes: "",
		year: "2024",
		genre: [
			"都市",
			"神话",
			"异能"
		],
		studio: "三九音域",
		link: "",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "葬送的芙莉莲 ",
		status: "planned",
		category: "anime",
		rating: 9.9,
		cover: "https://i0.hdslb.com/bfs/bangumi/image/f3ebb500b701a387f5abde67516c5c96bbd2faff.png@450w_600h.webp",
		description: "寿命逾千年的魔法使芙莉莲，以曾经共同战胜魔王的勇者辛美尔之死为契机，踏上了了解人类的旅途。邂逅了同属勇者小队的僧侣海塔与战士艾泽分别培养出的菲伦与休塔尔克，芙莉莲与二人一同前往灵魂安眠之地。去往此地需要【一级魔法使】资格，因此芙莉莲与菲伦前往魔法都市维萨斯特，参加一级魔法使选拔测验。在那里有着形形色色的卓越魔法使…此刻，最顶尖的魔法将在维萨斯特展开激烈碰撞！",
		episodes: "28",
		year: "2023",
		genre: [
			"漫画改",
			"奇幻",
			"治愈",
			"冒险"
		],
		studio: "MADHOUSE",
		link: "https://www.bilibili.com/bangumi/media/md21087073",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "十日终焉",
		status: "completed",
		category: "novel",
		rating: 9.9,
		cover: "https://tse3-mm.cn.bing.net/th/id/OIP-C.i3uZCP086j-vdREBJi8DCgHaKe?w=203&h=287&c=7&r=0&o=7&pid=1.7&rm=3",
		description: "当我以为这只是寻常的一天时，却发现自己被捉到了终焉之地。 当我以为只需要不断的参加死亡游戏就可以逃脱时，却发现众人开始觉醒超自然之力。 当我以为这里是「造神之地」时，一切却又奔着湮灭走去。",
		episodes: "",
		year: "2025",
		genre: [
			"脑洞",
			"推理",
			"无限流",
			"玄幻"
		],
		studio: "杀虫队队员",
		link: "",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "三角洲行动",
		status: "dropped",
		category: "game",
		rating: 2.5,
		cover: "https://ts2.tc.mm.bing.net/th/id/OADD2.1236950586074667_10E952XP1L5EA4O?w=64&h=64&o=6&pid=21.2",
		description: "",
		episodes: "",
		year: "",
		genre: [],
		studio: "",
		link: "https://df.qq.com/",
		progress: 0,
		totalEpisodes: 0
	},
	{
		title: "玉子市场",
		status: "planned",
		category: "anime",
		rating: 9.6,
		cover: "https://i0.hdslb.com/bfs/bangumi/67da3dae76e526a925b78b1d8abe21c870333491.jpg@450w_600h.webp",
		description: "\n座落某个小镇的兔子商店街上，有一间日式饼店，住着一位十分喜欢饼类小吃的高中一年级女生——玉子。除了偶尔在店铺协助父亲，以及钻研新口味的饼类小吃外，她亦有跟学校的朋友参与羽毛球部活动。而饼店对面是同行的竞争对手，两边的父亲经常都因生意问题而喧哗。不过对方儿子——饼藏却自小跟玉子建立青梅竹马的关系，近日更不断隐约地表达心思，只是玉子没有特别注意，更常常被旁观的朋友拿出来扰攘一番。总而言之，玉子就是在商店街众人的护荫下，如此热闹地渡过每一天，生活可谓过得相当快乐。除夕，也就是玉子的生日，处于商店街年末最繁忙的时刻。庆祝仪式已经成为了商店街上下的惯例，唯独今年的饼藏没有准时来到。直到他带着礼物来到之时……一只光辉灿烂的鸟出现...",
		episodes: "12",
		year: "2013",
		genre: [
			"萌系",
			"少女",
			"治愈",
			"日常"
		],
		studio: "京都アニメーション",
		link: "https://www.bilibili.com/bangumi/media/md116772",
		progress: 0,
		totalEpisodes: 0
	}
];

export default localAnimeList;
