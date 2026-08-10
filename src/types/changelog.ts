export type ChangelogType = "feature" | "improvement" | "fix" | "removal" | "other";

/**
 * 单条更新记录。
 * 多条为实现同一功能 / 修复同一问题 / 删除同一功能而产生的部署记录，
 * 在整理时合并为一条，并把相关 commit 汇总到 `commits` 字段。
 */
export interface ChangelogItem {
	/** 稳定唯一 id，用于锚点与去重 */
	id: string;
	/** 完整时间戳，如 "2026-08-10 20:39:52" */
	date: string;
	/** 版本号，连续部署项目采用「年.月.日」日历版本，如 "2026.08.10" */
	version: string;
	/** 变更类型：新增 / 优化 / 修复 / 删除 / 其他 */
	type: ChangelogType;
	/** 具体分类（同一类型下的细分主题） */
	category: string;
	/** 功能模块 */
	module: string;
	/** 简短标题 */
	title: string;
	/** 详细描述（可含换行） */
	description: string;
	/** 相关 commit 短哈希列表，便于溯源 */
	commits?: string[];
	/** 来源仓库：old = 已废弃的 yujingblog，new = yujingblog-site */
	repo?: "old" | "new";
}

/** 变更类型的中文标签与强调色（与站点主题变量对应） */
export const CHANGELOG_TYPE_META: Record<
	ChangelogType,
	{ label: string; icon: string; color: string }
> = {
	feature: { label: "新增", icon: "mdi:plus-circle", color: "var(--green)" },
	improvement: { label: "优化", icon: "mdi:trending-up", color: "var(--primary)" },
	fix: { label: "修复", icon: "mdi:bug", color: "var(--orange)" },
	removal: { label: "删除", icon: "mdi:minus-circle", color: "var(--red)" },
	other: { label: "其他", icon: "mdi:dots-horizontal-circle", color: "var(--grey)" },
};
