// Project data configuration file
// Used to manage data for the project display page

export interface Project {
	id: string;
	title: string;
	description: string;
	image: string;
	category: "web" | "mobile" | "desktop" | "other";
	techStack: string[];
	status: "completed" | "in-progress" | "planned";
	liveDemo?: string;
	sourceCode?: string;
	visitUrl?: string;
	startDate: string;
	endDate?: string;
	featured?: boolean;
	tags?: string[];
	showImage?: boolean;
}

export const projectsData: Project[] = [
	{
		id: "mizuki",
		title: "Mizuki",
		description:
			"一个现代化、功能丰富的静态博客模板，采用 Astro 构建，具备高级功能和精美设计。",
		image: "/assets/projects/mizuki.webp",
		category: "web",
		techStack: ["Astro", "TypeScript", "Tailwind CSS", "Svelte"],
		status: "in-progress",
		sourceCode: "https://github.com/LyraVoid/Mizuki",
		visitUrl: "https://www.yujingblog.top/",
		startDate: "2026-07-24",
		featured: true,
		tags: ["博客", "Web", "Open Source"],
	},
	{
		id: "iFlytek C8hPro刷机",
		title: "iFlytek-C8hPro-Crack",
		description:
			"关于iFlytek C8hPro平板刷机操作的一些研究很多地方尚有不足之处,在此抛砖引玉,欢迎各位读者开issues与我讨论。",
		image: "https://tse3-mm.cn.bing.net/th/id/OIP-C.szj3ICJ2dNTj9msTH7OeygAAAA?w=217&h=180&c=7&r=0&o=7&pid=1.7&rm=3",
		category: "mobile",
		techStack: ["spd_dump", "紫光展锐", "FDL", "GSI"],
		status: "completed",
		sourceCode: "https://github.com/lucian0107/iFlytek-C8hPro-Crack",
		startDate: "2026-05-28",
		endDate: "2026-05-28",
		featured: true,
		tags: ["Android", "Root"],
	},
	{
		id: "ClassIsland",
		title: "ClassIsland",
		description:
			"ClassIsland 是一款适用于班级多媒体屏幕的跨平台课表信息显示工具，可以在 Windows PC、Mac 及 Linux 设备屏幕上显示各种信息。本应用的名字灵感源于 iOS 灵动岛(Dynamic Island)功能。",
		image: "https://camo.githubusercontent.com/1e3b149c7768e03afb9cb0d13800e62350f1c1cbb0ed39938fd985f9d3df61a3/68747470733a2f2f7265732e636c61737369736c616e642e746563682f62616e6e6572732f62616e6e65722d76322d312e77656270",
		category: "desktop",
		techStack: [".NET", "Avalonia UI", "C++", "TypeScript "],
		status: "planned",
		sourceCode: "https://github.com/ClassIsland/ClassIsland",
		startDate: "",
		tags: [ "工具", "Desktop"],
		showImage: false,
	},	
	{
		id: "LX Music",
		title: "LX Music",
		description:
			"一个免费&开源的音乐查找工具",
		image: "",
		category: "desktop",
		techStack: ["Electron 30+","Vue 3"],
		status: "completed",
		sourceCode: "https://github.com/lyswhut/lx-music-desktop",
		startDate: "2025-01-01",
		endDate: "2025-01-01",
		featured: false,
		tags: ["Desktop", "音乐"],
	},
	{
		id: "Twikoo",
		title: "Twikoo",
		description:
			"网站评论系统，简洁、安全、免费",
		image: "",
		category: "web",
		techStack: ["npm","JavaScript"],
		status: "completed",
		sourceCode: "https://github.com/twikoojs/twikoo",
		startDate: "2026-07-26",
		endDate: "2026-07-26",
		featured: false,
		tags: ["Desktop", "音乐"],
	},
	{
		id: "CloudFlare ImgBed",
		title: "CloudFlare ImgBed",
		description:
			"开源文件托管解决方案,安心存取，轻松分享",
		image: "",
		category: "web",
		techStack: ["Vue 3","Cloudflare R2"],
		status: "in-progress",
		sourceCode: "https://github.com/MarSeventh/CloudFlare-ImgBed",
		visitUrl: "https://cfbed.sanyue.de/",
		startDate: "2026-07-30",
		endDate: "",
		featured: false,
		tags: ["Web", "Cloud"],
	},
	{
		id: "YuJingの宝藏之地",
		title: "YuJingの宝藏之地",
		description:
			"这是一个采用 Next.js 构建的高颜值、毛玻璃(Glassmorphism)风格个人博客系统。本项目自带完善的前端展示与独立的本地后台控制台，支持 Markdown 沉浸式写作、草稿管理以及便捷的图床配置。",
		image: "https://bee-reg-ab.imagency.cn/p/06b6388ada543c5ac377ec900aeed5f8.png",
		category: "web",
		techStack: ["Next.js 15","React 19","React 19"],
		status: "completed",
		sourceCode: "https://github.com/heiehiehi/XinghuisamaBlogs",
		visitUrl: "https://old.yujingblog.top/",
		startDate: "2026-07-21",
		endDate: "2026-07-24",
		featured: false,
		tags: ["Desktop", "音乐"],
	},
];

// Get projects by category
export const getProjectsByCategory = (category?: string) => {
	if (!category || category === "all") {
		return projectsData;
	}
	return projectsData.filter((p) => p.category === category);
};

// Get featured projects
export const getFeaturedProjects = () => {
	return projectsData.filter((p) => p.featured);
};

// Get all tech stacks
export const getAllTechStack = () => {
	const techSet = new Set<string>();
	projectsData.forEach((project) => {
		project.techStack.forEach((tech) => {
			techSet.add(tech);
		});
	});
	return Array.from(techSet).sort();
};
