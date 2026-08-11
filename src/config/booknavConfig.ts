import type { BooknavConfig, BooknavCategory } from "../types/booknavConfig";
import { websiteData } from "../data/website";

/**
 * 书签导航配置。
 * 数据来源：内容仓库 data/website.ts（经 sync-content 映射至 src/data/website），
 * 由 Pages CMS 后台 /admin/websites-edit 可视化编辑。
 * 此处仅定义「分类元数据」，书签条目由 websiteData 按 category 分组得到。
 * 图标使用图片外链（websiteData.imgurl）。
 */

interface CategoryMeta {
	id: string;
	name: string;
	description: string;
	icon: string;
}

const categoryMeta: CategoryMeta[] = [
	{ id: "dev", name: "开发", description: "写代码时离不开的站点", icon: "material-symbols:code" },
	{ id: "project", name: "项目", description: "好用的开源项目", icon: "material-symbols:folder" },
	{ id: "design", name: "设计", description: "配色、图标与灵感来源", icon: "material-symbols:brush" },
	{ id: "ai", name: "AI", description: "大模型与 AI 工具", icon: "material-symbols:smart-toy" },
	{ id: "tool", name: "工具", description: "顺手的在线小工具", icon: "material-symbols:build" },
	{ id: "resource", name: "资源", description: "文档、教程、阅读与下载", icon: "material-symbols:menu-book" },
];

const categories: BooknavCategory[] = categoryMeta.map((meta) => ({
	...meta,
	items: websiteData
		.filter((item) => item.category === meta.id)
		.map((item) => ({
			name: item.title,
			description: item.desc,
			url: item.siteurl,
			icon: item.imgurl,
		})),
}));

export const booknavConfig: BooknavConfig = {
	title: "网站收藏",
	subtitle: "收藏一些好用的网站，按分类整理",
	placeholder: "搜索书签...",
	categories,
};
