/**
 * 更新日志数据适配器
 * --------------------------------------------------------------------------
 * 将用户博客现有的 ChangelogItem（src/config/changelog.ts）转换为
 * ChangelogGraph 组件所需的 ChangelogEntry 结构，并基于 module 字段
 * 构建同模块更新之间的关联线。
 */

import type { ChangelogItem, ChangelogType as SourceType } from "../types/changelog";

export type ChangelogType = "feat" | "fix" | "style" | "refactor" | "chore";

export interface ChangelogEntry {
	title: string;
	/** YYYY-MM-DD（从 date 字段提取） */
	date: string;
	/** 卡片上显示的一句话简述 */
	summary: string;
	/** 弹窗中显示的完整说明 */
	detail: string;
	/** 涉及的模块标识 */
	pages: string[];
	type: ChangelogType;
}

export interface ModuleMeta {
	label: string;
	url?: string;
}

/** 常见模块 → 中文展示名（未知标识原样保留） */
export const MODULE_META: Record<string, ModuleMeta> = {
	全局: { label: "全站" },
	site: { label: "全站" },
	音乐: { label: "音乐", url: "/music/" },
	音乐播放器: { label: "音乐", url: "/music/" },
	"3D音乐": { label: "3D 音乐", url: "/music-3d/" },
	评论: { label: "评论" },
	留言板: { label: "留言板", url: "/guestbook/" },
	部署: { label: "部署" },
	编辑器: { label: "编辑器" },
	设备: { label: "设备", url: "/devices/" },
	足迹: { label: "足迹", url: "/footprint/" },
	日记: { label: "日记", url: "/diary/" },
	追番: { label: "追番", url: "/anime/" },
	友链: { label: "友链", url: "/friends/" },
	首页: { label: "首页", url: "/" },
	文章: { label: "文章" },
	归档: { label: "归档", url: "/archive/" },
	标签: { label: "标签", url: "/categories/" },
	相册: { label: "相册", url: "/gallery/" },
	关于: { label: "关于", url: "/about/" },
	看板娘: { label: "看板娘" },
	移动端: { label: "移动端" },
	更新日志: { label: "更新日志", url: "/changelog/" },
	网站导航: { label: "网站导航" },
};

const TYPE_MAP: Record<SourceType, ChangelogType> = {
	feature: "feat",
	improvement: "refactor",
	fix: "fix",
	removal: "refactor",
	other: "chore",
};

const VALID_TYPES: readonly ChangelogType[] = [
	"feat",
	"fix",
	"style",
	"refactor",
	"chore",
];

function normalizeType(raw: SourceType | string): ChangelogType {
	const value = (raw ?? "").trim().toLowerCase();
	if ((VALID_TYPES as readonly string[]).includes(value)) return value as ChangelogType;
	return TYPE_MAP[value as SourceType] ?? "chore";
}

function extractDate(dateTime: string): string {
	return dateTime.slice(0, 10);
}

function extractSummary(description: string): string {
	if (!description) return "";
	// 优先按中文句号、换行截取前两句/两行
	const sentences = description
		.split(/[。！？\n]+/)
		.map((s) => s.trim())
		.filter(Boolean);
	const first = sentences[0] ?? "";
	const second = sentences[1] ?? "";
	let summary = first;
	if (second && summary.length + second.length <= 90) summary += "。" + second;
	if (summary.length > 90) summary = summary.slice(0, 90) + "…";
	return summary;
}

function splitModules(moduleName: string): string[] {
	return moduleName
		.split(/[,，、/|\\s]+/)
		.map((m) => m.trim())
		.filter(Boolean);
}

/** 将用户博客的 ChangelogItem 转换为图谱组件可用的 ChangelogEntry */
export function adaptChangelogItems(items: ChangelogItem[]): ChangelogEntry[] {
	return items.map((item) => ({
		title: item.title,
		date: extractDate(item.date),
		summary: extractSummary(item.description),
		detail: item.description,
		pages: splitModules(item.module),
		type: normalizeType(item.type),
	}));
}

export interface ChangelogLink {
	target: number;
	sharedPages: string[];
}

/**
 * 构建关联邻接表：两条记录共享至少一个 module 即互相关联。
 * 返回 Map<记录下标, 关联列表>，按下标引用（与数组顺序一致）。
 */
export function buildChangelogLinks(
	entries: ChangelogEntry[],
): Map<number, ChangelogLink[]> {
	const links = new Map<number, ChangelogLink[]>();
	for (let i = 0; i < entries.length; i++) {
		for (let j = i + 1; j < entries.length; j++) {
			const sharedPages = entries[i].pages.filter((page) =>
				entries[j].pages.includes(page),
			);
			if (sharedPages.length === 0) continue;
			if (!links.has(i)) links.set(i, []);
			if (!links.has(j)) links.set(j, []);
			links.get(i)?.push({ target: j, sharedPages });
			links.get(j)?.push({ target: i, sharedPages });
		}
	}
	return links;
}
