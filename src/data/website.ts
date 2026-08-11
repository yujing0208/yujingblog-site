// 网站收藏（书签导航）数据配置
// 由站点 /websites 页面读取，并按下 category 分组展示。
// 图标使用图片外链（imgurl 字段）；分类 category 取值：dev | project | design | ai | tool | resource
export interface WebsiteItem {
	id?: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	category: "dev" | "project" | "design" | "ai" | "tool" | "resource";
	tags?: string[];
}


export const websiteData: WebsiteItem[] = [
	// 开发
	{ title: "GitHub", imgurl: "https://favicon.im/github.com", desc: "全球最大的代码托管平台", siteurl: "https://github.com", category: "dev" },
	{ title: "MDN Web Docs", imgurl: "https://favicon.im/developer.mozilla.org", desc: "最权威的 Web 文档", siteurl: "https://developer.mozilla.org", category: "dev" },
	{ title: "Astro", imgurl: "https://favicon.im/astro.build", desc: "内容驱动型网站的 Web 框架", siteurl: "https://astro.build", category: "dev" },
	{ title: "Svelte", imgurl: "https://favicon.im/svelte.dev", desc: "把组件编译成高效原生 JS 的框架", siteurl: "https://svelte.dev", category: "dev" },
	{ title: "Tailwind CSS", imgurl: "https://favicon.im/tailwindcss.com", desc: "一个功能强大且灵活的 CSS 框架", siteurl: "https://tailwindcss.com", category: "dev" },
	{ title: "Cloudflare", imgurl: "https://favicon.im/cloudflare.com", desc: "为你的站点提供免费防护与加速", siteurl: "https://dash.cloudflare.com", category: "dev" },
	{ title: "Vercel", imgurl: "https://favicon.im/vercel.com", desc: "Develop. Preview. Ship.", siteurl: "https://vercel.com", category: "dev" },
	{ title: "Twikoo", imgurl: "https://favicon.im/twikoo.js.org", desc: "网站评论系统，简洁、安全、免费", siteurl: "https://twikoo.js.org", category: "dev" },
	{ title: "Mizuki Docs", imgurl: "https://favicon.im/docs.mizuki.mysqil.com", desc: "Mizuki 博客主题使用手册", siteurl: "https://docs.mizuki.mysqil.com", category: "dev" },

	// 项目
	{ title: "Firefly", imgurl: "https://favicon.im/github.com", desc: "清晰美观的 Astro 个人博客主题模板", siteurl: "https://github.com/Moelten/astro-theme-firefly", category: "project" },

	// 设计
	{ title: "Iconify", imgurl: "https://favicon.im/iconify.design", desc: "开源图标集的家园", siteurl: "https://iconify.design", category: "design" },
	{ title: "iconfont", imgurl: "https://favicon.im/iconfont.cn", desc: "阿里巴巴矢量图标库", siteurl: "https://www.iconfont.cn", category: "design" },
	{ title: "Favicon.im", imgurl: "https://favicon.im/favicon.im", desc: "即时网站图标获取器", siteurl: "https://favicon.im/zh", category: "design" },
	{ title: "One Page Love", imgurl: "https://favicon.im/onepagelove.com", desc: "一页网站灵感，精心策划", siteurl: "https://onepagelove.com", category: "design" },

	// AI
	{ title: "DeepSeek", imgurl: "https://favicon.im/deepseek.com", desc: "深度求索，探索未至之境", siteurl: "https://www.deepseek.com", category: "ai" },
	{ title: "豆包", imgurl: "https://favicon.im/doubao.com", desc: "字节跳动旗下 AI 智能助手", siteurl: "https://www.doubao.com", category: "ai" },
	{ title: "千问", imgurl: "https://favicon.im/qianwen.com", desc: "阿里 Qwen 最新模型体验", siteurl: "https://www.qianwen.com", category: "ai" },
	{ title: "OpenAI", imgurl: "https://favicon.im/openai.com", desc: "ChatGPT 与先进 AI 研究", siteurl: "https://openai.com", category: "ai" },
	{ title: "Claude", imgurl: "https://favicon.im/claude.ai", desc: "Anthropic 出品的 AI 助手", siteurl: "https://claude.ai", category: "ai" },
	{ title: "skills mp", imgurl: "https://favicon.im/skillsmp.com", desc: "看人们正在教 AI 智能体做些什么", siteurl: "https://skillsmp.com/zh", category: "ai" },
	{ title: "PromptPilot", imgurl: "https://favicon.im/volcengine.com", desc: "火山引擎推出的提示词优化平台", siteurl: "https://promptpilot.volcengine.com", category: "ai" },
	{ title: "Imagio", imgurl: "https://favicon.im/oblivionis.net", desc: "用文字描述生成或编辑图片", siteurl: "https://image.oblivionis.net", category: "ai" },

	// 工具
	{ title: "TinyPNG", imgurl: "https://favicon.im/tinypng.com", desc: "在线压缩 PNG / JPEG 图片", siteurl: "https://tinypng.com", category: "tool" },
	{ title: "Squoosh", imgurl: "https://favicon.im/squoosh.app", desc: "Google 出品的图片压缩与格式转换", siteurl: "https://squoosh.app", category: "tool" },
	{ title: "Carbon", imgurl: "https://favicon.im/carbon.now.sh", desc: "把代码片段生成漂亮的图片", siteurl: "https://carbon.now.sh", category: "tool" },
	{ title: "GitHub 加速", imgurl: "https://favicon.im/gh-proxy.com", desc: "多区域加速，解决 GitHub 访问慢、下载失败", siteurl: "https://gh-proxy.com", category: "tool" },
	{ title: "GitHub Proxy", imgurl: "https://favicon.im/github.akams.cn", desc: "支持 API、Clone、Releases 等资源加速下载", siteurl: "https://github.akams.cn", category: "tool" },
	{ title: "GitHub 文件加速", imgurl: "https://favicon.im/ghproxy.net", desc: "支持 release、archive 与文件加速", siteurl: "https://ghproxy.net", category: "tool" },
	{ title: "坐标拾取器", imgurl: "https://favicon.im/amap.com", desc: "高德地图获取精确经纬度坐标", siteurl: "https://lbs.amap.com/tools/picker", category: "tool" },
	{ title: "免费在线抠图", imgurl: "https://favicon.im/koukoutu.com", desc: "无需上传的在线图像抠图工具", siteurl: "https://www.koukoutu.com/removebgtool/all", category: "tool" },
	{ title: "imagesTool", imgurl: "https://favicon.im/imagestool.com", desc: "无需上传文件也可在线处理图片", siteurl: "https://imagestool.com/zh_CN", category: "tool" },
	{ title: "Itdog 在线测速", imgurl: "https://favicon.im/itdog.cn", desc: "在线网络工具箱，网站测速", siteurl: "https://www.itdog.cn", category: "tool" },
	{ title: "免费在线视频压缩", imgurl: "https://favicon.im/videocompress.io", desc: "支持 MP4、MOV、WebM 等格式压缩", siteurl: "https://videocompress.io/zh-cn", category: "tool" },
	{ title: "OpenMediaTools", imgurl: "https://favicon.im/openmedia.tools", desc: "免费在线视频、音频、图像与 PDF 工具", siteurl: "https://openmedia.tools/zh", category: "tool" },
	{ title: "小小 API", imgurl: "https://favicon.im/xxapi.cn", desc: "专业的 API 服务平台", siteurl: "https://xxapi.cn", category: "tool" },
	{ title: "UApiPro", imgurl: "https://favicon.im/uapis.cn", desc: "免费、稳定、快速的公共 API", siteurl: "https://uapis.cn", category: "tool" },

	// 资源
	{ title: "Firefly Docs", imgurl: "https://favicon.im/firefly.cuteleaf.cn", desc: "Firefly 主题模板文档", siteurl: "https://firefly.cuteleaf.cn/docs", category: "resource" },
	{ title: "夏夜流萤", imgurl: "https://favicon.im/firefly.cuteleaf.cn", desc: "飞萤之火自无梦的长夜亮起", siteurl: "https://firefly.cuteleaf.cn", category: "resource" },
	{ title: "AGE 动漫", imgurl: "https://favicon.im/agedm.io", desc: "免费动漫资源聚合站", siteurl: "https://www.agedm.io", category: "resource" },
	{ title: "MANHWATOP", imgurl: "https://favicon.im/manhwatop.com", desc: "收录漫画资源", siteurl: "https://manhwatop.com", category: "resource" },
	{ title: "Z-Library", imgurl: "https://favicon.im/kid1412.by", desc: "世界上最大的电子图书馆", siteurl: "https://zh.kid1412.by", category: "resource" },
	{ title: "哲风壁纸", imgurl: "https://favicon.im/haowallpaper.com", desc: "免费 4K 高清壁纸网站", siteurl: "https://haowallpaper.com", category: "resource" },
	{ title: "Emojiall", imgurl: "https://favicon.im/emojiall.com", desc: "Emoji 大全", siteurl: "https://www.emojiall.com/zh-hans", category: "resource" },
	{ title: "叮叮猫资源搜索", imgurl: "https://favicon.im/boosds.cn", desc: "免费分享百万级网盘资源", siteurl: "https://www.boosds.cn", category: "resource" },
	{ title: "LX Music", imgurl: "https://favicon.im/lxmusic.toside.cn", desc: "免费开源的音乐查找工具", siteurl: "https://lxmusic.toside.cn", category: "resource" },
	{ title: "蜜蜂图床", imgurl: "https://favicon.im/beeimg.cn", desc: "免费、稳定、高速的图片外链服务", siteurl: "https://www.beeimg.cn", category: "resource" },
	{ title: "YuJing ImgHub", imgurl: "https://favicon.im/img.yujingblog.top", desc: "我的个人图床", siteurl: "https://img.yujingblog.top", category: "resource" },
	{ title: "StarDots 图床", imgurl: "https://favicon.im/stardots.io", desc: "图像云存储，图片托管", siteurl: "https://dashboard.stardots.io", category: "resource" },
	{ title: "CloudFlare ImgBed", imgurl: "https://favicon.im/sanyue.de", desc: "开源文件托管解决方案", siteurl: "https://cfbed.sanyue.de", category: "resource" },
	{ title: "PigHub", imgurl: "https://favicon.im/pighub.top", desc: "最大的猪猪图片网站", siteurl: "https://www.pighub.top", category: "resource" },
	{ title: "升学 E 网通", imgurl: "https://favicon.im/ewt360.com", desc: "高中生综合指导与备考系统", siteurl: "https://www.ewt360.com", category: "resource" },
	{ title: "Qwerty Learner", imgurl: "https://favicon.im/qwerty.kaiyi.cool", desc: "键盘工作者单词记忆软件", siteurl: "https://qwerty.kaiyi.cool", category: "resource" },
	{ title: "合肥一中电脑社", imgurl: "https://favicon.im/hfyzdns.cn", desc: "零基础友好 · 技术驱动的校园科技社团", siteurl: "https://hfyzdns.cn", category: "resource" },
	{ title: "合肥市第一中学", imgurl: "https://favicon.im/hfyz.net", desc: "怀天下抱负，做未来主人", siteurl: "http://www.hfyz.net/sy/index.html", category: "resource" },
];
