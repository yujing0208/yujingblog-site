export interface BooknavItem {
	name: string;
	description?: string;
	url: string;
	icon?: string;
	color?: string;
	tags?: string[];
}

export interface BooknavCategory {
	id: string;
	name: string;
	description?: string;
	icon: string;
	items: BooknavItem[];
}

export interface BooknavConfig {
	title: string;
	subtitle?: string;
	placeholder?: string;
	categories: BooknavCategory[];
}
