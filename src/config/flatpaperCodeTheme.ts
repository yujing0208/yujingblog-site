/**
 * FlatPaper 代码块配色（对齐主题演示站 `code.theme: simple`）
 *
 * 演示站 simple 主题的 token 配色不看 Shiki 主题，而是直接吃站点语义令牌：
 *   comment(.comment/.quote)        → var(--muted)（斜体）
 *   keyword/tag/string/addition     → var(--color-accent)
 *   number/attr/variable/type/class → var(--orange)
 *   title/name/selector-class/property/attribute → var(--blue)
 *   default/params                  → var(--ink)
 *
 * Shiki 主题只能在构建期写死 hex，所以这里把「语义令牌在本站的亮/暗真值」
 * 分别写成两套主题，再由 paper-markdown.css 把这些 hex 反向映射回 CSS 变量，
 * 这样 7 套主题色切换时代码块也能跟着变。
 *
 * scope 的取舍按「演示站用的 highlight.js 类名」反推：
 *   对象键 / YAML 键  → highlight.js `.attr`        → orange
 *   CSS 属性名         → highlight.js `.attribute`   → blue
 *   函数名 / 类选择器  → `.title` / `.selector-class` → blue
 */

type TokenSetting = {
	scope?: string | string[];
	settings: {
		foreground?: string;
		fontStyle?: string;
	};
};

/** 亮色档：对应 :root 的语义令牌（--muted / --color-accent / --orange / --blue / --ink / --red） */
const LIGHT = {
	comment: "#8a8678", // var(--muted)
	accent: "#6fa67c", // var(--color-accent) 默认 green
	orange: "#ec9b5b", // var(--orange)
	blue: "#6fa9d9", // var(--blue)
	ink: "#2c3531", // var(--ink)
	danger: "#d4716c", // var(--red)
	bg: "#f8f2e2", // var(--paper-warm)
};

/** 暗色档：对应 :root.dark 的语义令牌 */
const DARK = {
	comment: "#797f8c",
	accent: "#82bf90",
	orange: "#e09b66",
	blue: "#7db4dd",
	ink: "#e6e8ee",
	danger: "#df8580",
	bg: "#272b34",
};

function buildSettings(c: typeof LIGHT): TokenSetting[] {
	return [
		/* ---- comment：--muted，斜体 ---- */
		{
			scope: [
				"comment",
				"punctuation.definition.comment",
				"quote",
				"blockquote",
			],
			settings: { foreground: c.comment, fontStyle: "italic" },
		},
		/* ---- 默认文本：--ink ---- */
		{
			scope: ["source", "meta.embedded", "punctuation", "params"],
			settings: { foreground: c.ink },
		},
		/* ---- keyword / tag / string → --color-accent ---- */
		{
			scope: [
				"keyword",
				"keyword.control",
				"keyword.operator",
				"storage",
				"storage.type",
				"literal",
				"variable.language",
				"constant.language",
			],
			settings: { foreground: c.accent, fontStyle: "bold" },
		},
		{
			scope: [
				"string",
				"regexp",
				"meta.string",
				"constant.other.symbol",
				"punctuation.definition.string",
			],
			settings: { foreground: c.accent },
		},
		{
			scope: [
				"tag",
				"punctuation.definition.tag",
				"entity.name.tag",
				"doctag",
			],
			settings: { foreground: c.accent },
		},
		{
			scope: ["addition"],
			settings: { foreground: c.accent },
		},
		/* ---- number / attr / variable / type / class → --orange ---- */
		{
			scope: ["constant.numeric", "number", "symbol", "bullet"],
			settings: { foreground: c.orange },
		},
		{
			scope: [
				"variable",
				"variable.other",
				"variable.parameter",
				"attr",
				"entity.other.attribute-name",
				"template-variable",
				"entity.name.type",
				"support.class",
				"support.type",
				"type",
				"class",
			],
			settings: { foreground: c.orange },
		},
		/* 对象键 / YAML·TOML 键 → highlight.js `.attr` → orange */
		{
			scope: [
				"meta.object-literal.key",
				"entity.name.tag.yaml",
				"entity.name.tag.toml",
				"support.type.property-name",
			],
			settings: { foreground: c.orange },
		},
		/* ---- 函数名 / CSS 属性名 / 类选择器 → --blue ---- */
		{
			scope: [
				"entity.name.function",
				"support.function",
				"variable.function",
				"title",
				"name",
				"selector-id",
				"selector-class",
			],
			settings: { foreground: c.blue, fontStyle: "bold" },
		},
		{
			scope: [
				"property",
				"property-name",
				"attribute",
				"source.css support.type.property-name",
				"source.css meta.property-name",
			],
			settings: { foreground: c.blue },
		},
		/* ---- deletion ---- */
		{
			scope: ["deletion", "invalid"],
			settings: { foreground: c.danger },
		},
	];
}

export const flatpaperCodeThemeLight = {
	name: "flatpaper-light",
	type: "light" as const,
	colors: {
		"editor.background": LIGHT.bg,
		"editor.foreground": LIGHT.ink,
	},
	tokenColors: buildSettings(LIGHT),
	settings: buildSettings(LIGHT),
};

export const flatpaperCodeThemeDark = {
	name: "flatpaper-dark",
	type: "dark" as const,
	colors: {
		"editor.background": DARK.bg,
		"editor.foreground": DARK.ink,
	},
	tokenColors: buildSettings(DARK),
	settings: buildSettings(DARK),
};
