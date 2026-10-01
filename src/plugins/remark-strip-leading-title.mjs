/**
 * 去掉正文开头的 H1 大标题。
 *
 * FlatPaper 演示站的正文（`.article-content`）里没有 `<h1>`：文章大标题只由
 * frontmatter 的 `title` 提供，渲染在 `.article-header` 里。本站文章大多在
 * frontmatter 之后又写了一行 `# 标题`（22 篇里 15 篇如此），于是在文章页会
 * 出现「文章头一个 H1 + 正文又一个 H1」的重复大标题。
 *
 * 这里在 mdast 阶段摘掉「文档第一个内容节点」，且仅当它是 depth=1 的标题：
 *  - 只处理文档开头，正文中间的 `#` 标题一律不动；
 *  - 前导空行 / 空白文本节点不算内容，不影响判断；
 *  - 若首节点不是 H1（例如 about.md 以原始 HTML 开头），不做任何修改。
 */

const isBlank = (node) =>
	(!node.type || node.type === "text") && String(node.value ?? "").trim() === "";

export function remarkStripLeadingTitle() {
	return (tree) => {
		const children = Array.isArray(tree?.children) ? tree.children : [];
		const index = children.findIndex((node) => !isBlank(node));
		if (index === -1) {
			return;
		}
		const first = children[index];
		if (first.type === "heading" && first.depth === 1) {
			children.splice(index, 1);
		}
	};
}
