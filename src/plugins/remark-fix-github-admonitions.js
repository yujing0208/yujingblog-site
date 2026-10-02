import { visit } from "unist-util-visit";

// GitHub alert 首行：`[!TYPE]` 单独成行，或 `[!TYPE] 自定义标题`
const GITHUB_ALERT_HEAD_REGEX = /^\s*\[!(?<type>\w+)\](?:[ \t]+(?<title>.+?))?\s*$/;
const GITHUB_ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"];

/**
 * GitHub alert 语义色 → FlatPaper note 变体（与 GitHub 呈现一致）：
 *   NOTE 蓝 → info；TIP 绿 → success；IMPORTANT 紫 → primary；
 *   WARNING 黄 → warning；CAUTION 红 → danger
 */
const VARIANT_BY_GITHUB_TYPE = {
	NOTE: "info",
	TIP: "success",
	IMPORTANT: "primary",
	WARNING: "warning",
	CAUTION: "danger",
};

function parseGithubAlertHead(text) {
	const match = text.match(GITHUB_ALERT_HEAD_REGEX);
	const type = match?.groups?.type?.toUpperCase();
	if (!type || !GITHUB_ALERT_TYPES.includes(type)) {
		return null;
	}
	return { type, title: match.groups.title?.trim() || null };
}

export function remarkFixGithubAdmonitions() {
	return (tree) => {
		visit(tree, "blockquote", (node, index, parent) => {
			if (!parent || index === undefined) {
				return;
			}

			const firstChild = node.children[0];
			if (firstChild?.type !== "paragraph") {
				return;
			}

			const firstParagraphChild = firstChild.children[0];
			if (firstParagraphChild?.type !== "text") {
				return;
			}

			const possibleTypeDeclaration = firstParagraphChild.value.split("\n")[0];
			if (!possibleTypeDeclaration) {
				return;
			}

			const head = parseGithubAlertHead(possibleTypeDeclaration);
			if (!head) {
				return;
			}

			const name = VARIANT_BY_GITHUB_TYPE[head.type];

			// 首行是 `[!TYPE]`（可带标题），其后的行是正文
			const bodyText = firstParagraphChild.value
				.split("\n")
				.slice(1)
				.join("\n");

			const bodyChildren = bodyText.trim()
				? [{ type: "text", value: bodyText.replace(/^\s*\n/, "") }]
				: [];

			const paragraphChildren = [
				...bodyChildren,
				...firstChild.children.slice(1),
			];

			const contentChildren =
				paragraphChildren.length > 0
					? [{ type: "paragraph", children: paragraphChildren }]
					: [];

			const children = [...contentChildren, ...node.children.slice(1)];

			// `[!TYPE] 标题` → 带 label 的指令 → 渲染为可折叠的 note 块
			if (head.title) {
				children.unshift({
					type: "paragraph",
					data: { directiveLabel: true },
					children: [{ type: "text", value: head.title }],
				});
			}

			const directive = {
				type: "containerDirective",
				name,
				children,
			};

			parent.children[index] = directive;
		});
	};
}
