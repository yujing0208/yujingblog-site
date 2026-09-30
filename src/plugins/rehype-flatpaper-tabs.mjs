/// <reference types="mdast" />
import { h } from "hastscript";
import { visit } from "unist-util-visit";

/**
 * FlatPaper 选项卡（flatpaper-tabs）。
 *
 * 写法（外层比内层多一个冒号，remark-directive 才不会把内层当成外层结束符）：
 *
 *   ::::tabs
 *   :::tab[段落]
 *   内容…
 *   :::
 *   :::tab[列表]
 *   内容…
 *   :::
 *   ::::
 *
 * 可选参数：`::::tabs{active=-1}` 表示默认不展开任何面板（对应演示站 .is-collapsible）。
 *
 * 输出结构逐字对齐演示站 demo_post.html：
 *   .flatpaper-tabs[.is-collapsible]
 *     .flatpaper-tabs__intro?
 *     .flatpaper-tabs__nav > button.flatpaper-tabs__nav-item[.is-active]
 *     .flatpaper-tabs__panels > section.flatpaper-tabs__panel[.is-active][hidden]
 */

function textOf(node) {
	if (!node) return "";
	if (typeof node === "string") return node;
	if (node.type === "text") return node.value ?? "";
	if (Array.isArray(node.children)) return node.children.map(textOf).join("");
	return "";
}

/** 去掉 children 首尾的空白文本节点 */
function trimWhitespace(children) {
	const out = [...children];
	while (out.length && out[0].type === "text" && !out[0].value.trim()) out.shift();
	while (
		out.length &&
		out[out.length - 1].type === "text" &&
		!out[out.length - 1].value.trim()
	)
		out.pop();
	return out;
}

export function rehypeFlatpaperTabs() {
	return (tree) => {
		let counter = 0;

		visit(tree, "element", (node, index, parent) => {
			if (!parent || index === null || index === undefined) return;
			if (node.tagName !== "tabs") return;

			const id = `tabs-${++counter}`;
			const activeProp = node.properties?.active;
			const activeIndex =
				activeProp === undefined || activeProp === null || activeProp === ""
					? 0
					: Number.parseInt(String(activeProp), 10);

			const children = trimWhitespace(node.children ?? []);
			const tabs = [];
			const intro = [];

			for (const child of children) {
				if (child.type === "element" && child.tagName === "tab") {
					const tabChildren = trimWhitespace(child.children ?? []);
					let label = "";
					let content = tabChildren;
					if (
						child.properties &&
						("has-directive-label" in child.properties ||
							"hasDirectiveLabel" in child.properties)
					) {
						label = textOf(tabChildren[0]).trim();
						content = tabChildren.slice(1);
					}
					if (!label) label = `标签 ${tabs.length + 1}`;
					tabs.push({ label, content });
				} else if (tabs.length === 0) {
					intro.push(child);
				}
			}

			if (tabs.length === 0) return;

			const navItems = tabs.map((tab, i) =>
				h(
					"button",
					{
						type: "button",
						role: "tab",
						id: `${id}-tab-${i}`,
						"aria-controls": `${id}-panel-${i}`,
						"aria-selected": String(i === activeIndex),
						class: [
							"flatpaper-tabs__nav-item",
							...(i === activeIndex ? ["is-active"] : []),
						],
						"data-index": String(i),
					},
					tab.label,
				),
			);

			const panels = tabs.map((tab, i) =>
				h(
					"section",
					{
						role: "tabpanel",
						id: `${id}-panel-${i}`,
						"aria-labelledby": `${id}-tab-${i}`,
						class: [
							"flatpaper-tabs__panel",
							...(i === activeIndex ? ["is-active"] : []),
						],
						"data-index": String(i),
						...(i === activeIndex ? {} : { hidden: true }),
					},
					tab.content,
				),
			);

			const wrapper = h(
				"div",
				{
					class: [
						"flatpaper-tabs",
						...(activeIndex < 0 ? ["is-collapsible"] : []),
					],
				},
				[
					...(intro.length
						? [h("div", { class: "flatpaper-tabs__intro" }, intro)]
						: []),
					h("div", { class: "flatpaper-tabs__nav", role: "tablist" }, navItems),
					h("div", { class: "flatpaper-tabs__panels" }, panels),
				],
			);

			parent.children[index] = wrapper;
		});
	};
}
