export type ChangelogType = "feature" | "improvement" | "fix" | "removal" | "other";

export interface ChangelogItem {
	hash: string;
	date: string;
	message: string;
	type: ChangelogType;
}

export interface ChangelogFilterTab {
	value: ChangelogType | "all";
	label: string;
	icon: string;
	count: number;
}
