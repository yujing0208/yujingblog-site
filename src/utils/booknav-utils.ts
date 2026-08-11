/**
 * 书签导航工具函数
 * 从 Firefly 主题迁移，适配本站结构。
 */
import type { BooknavCategory, BooknavItem } from "../types/booknavConfig";

export interface FilteredBooknav {
	categories: BooknavCategory[];
	totalItems: number;
	filteredItems: number;
}

/**
 * 根据搜索词过滤书签分类与条目。
 * 搜索范围：名称、描述、标签。
 */
export function filterBooknav(
	categories: BooknavCategory[],
	searchTerm: string,
): FilteredBooknav {
	const trimmed = searchTerm.trim().toLowerCase();

	if (!trimmed) {
		const totalItems = categories.reduce(
			(sum, category) => sum + category.items.length,
			0,
		);
		return { categories, totalItems, filteredItems: totalItems };
	}

	let filteredCount = 0;
	const filteredCategories = categories
		.map((category) => {
			const matchedItems = category.items.filter((item) =>
				matchesSearch(item, trimmed),
			);
			filteredCount += matchedItems.length;
			return { ...category, items: matchedItems };
		})
		.filter((category) => category.items.length > 0);

	const totalItems = categories.reduce(
		(sum, category) => sum + category.items.length,
		0,
	);

	return {
		categories: filteredCategories,
		totalItems,
		filteredItems: filteredCount,
	};
}

function matchesSearch(item: BooknavItem, term: string): boolean {
	const searchable = [
		item.name,
		item.description ?? "",
		...(item.tags ?? []),
	]
		.join(" ")
		.toLowerCase();
	return searchable.includes(term);
}

/**
 * 统计每个分类的条目数量。
 */
export function countCategoryItems(categories: BooknavCategory[]): Record<string, number> {
	return Object.fromEntries(categories.map((c) => [c.id, c.items.length]));
}

/**
 * 高亮文本中的搜索关键词。
 */
export function highlightText(text: string, searchTerm: string): string {
	if (!searchTerm.trim()) return text;
	const term = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`(${term})`, "gi");
	return text.replace(regex, '<mark class="booknav-highlight">$1</mark>');
}
