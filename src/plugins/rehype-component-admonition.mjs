/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * FlatPaper 风格的提示块（flatpaper-note）。
 *
 * 演示站用 `:::` 容器语法渲染成：
 *   <div class="flatpaper-note flatpaper-note--default">
 *     <span class="flatpaper-note__icon"></span>
 *     <div class="flatpaper-note__body">…</div>
 *   </div>
 * 带标题时外层为 <details> + <summary class="flatpaper-note__title">…</summary>，
 * 渲染为可折叠块。
 *
 * 本站指令名 → 演示站变体：
 *   note      → default
 *   important → primary
 *   tip       → success
 *   info      → info
 *   caution   → warning
 *   warning   → warning
 *   danger    → danger
 */
const VARIANT_BY_TYPE = {
	note: "default",
	default: "default",
	primary: "primary",
	important: "primary",
	tip: "success",
	success: "success",
	info: "info",
	caution: "warning",
	warning: "warning",
	danger: "danger",
	error: "danger",
};

/** 取出 directive label 的纯文本 */
function textOf(node) {
	if (!node) return "";
	if (typeof node === "string") return node;
	if (node.type === "text") return node.value ?? "";
	if (Array.isArray(node.children)) return node.children.map(textOf).join("");
	return "";
}

/**
 * Creates a FlatPaper note component.
 *
 * @param {Object} properties - The properties of the component.
 * @param {('note'|'tip'|'important'|'caution'|'warning'|'info'|'danger')} type - The note type.
 * @param {import('mdast').RootContent[]} children - The children elements of the component.
 * @returns {import('mdast').Parent} The created note component.
 */
export function AdmonitionComponent(properties, children, type) {
	if (!Array.isArray(children) || children.length === 0) {
		return h(
			"div",
			{ class: "hidden" },
			'Invalid admonition directive. (Admonition directives must be of block type ":::note{name="name"} <content> :::")',
		);
	}

	const variant = VARIANT_BY_TYPE[type] ?? "default";
	const className = ["flatpaper-note", `flatpaper-note--${variant}`];

	let label = null;
	if (properties?.["has-directive-label"]) {
		label = textOf(children[0]).trim();
		// biome-ignore lint/style/noParameterAssign: <check later>
		children = children.slice(1);
	}

	const body = h("div", { class: "flatpaper-note__body" }, children);

	if (label) {
		return h("details", { class: className.join(" ") }, [
			h("summary", { class: "flatpaper-note__title" }, [
				h("span", { class: "flatpaper-note__icon", "aria-hidden": "true" }),
				h("span", { class: "flatpaper-note__label" }, label),
				h("span", { class: "flatpaper-note__chevron", "aria-hidden": "true" }),
			]),
			body,
		]);
	}

	return h("div", { class: className.join(" ") }, [
		h("span", { class: "flatpaper-note__icon", "aria-hidden": "true" }),
		body,
	]);
}
