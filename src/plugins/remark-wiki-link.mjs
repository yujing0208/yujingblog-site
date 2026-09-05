// remark-wiki-link.mjs
//
// 为博客文章添加 Obsidian 风格的 Wiki Link 支持：
//   [[slug]]            单独成段 -> 渲染为文章卡片；行内 -> 渲染为内部链接
//   [[slug|别名]]        自定义显示文本
//   [[slug#标题]]        链接到另一篇文章的某个标题锚点
//   [[#标题]]            链接到当前页面的某个标题锚点
//   ![[xxx]]             不被处理（附件嵌入语法原样保留）
//   代码块 / 行内代码 / 原始 HTML 中的 [[...]] 不做转换
//
import fs from "node:fs";
import path from "node:path";

const POSTS_DIR = path.resolve(process.cwd(), "src/content/posts");

// ─── 本地封面资源映射（用于解析相对路径的封面图）────────────────────
// 大多数文章封面为远程 URL，此处仅作为相对路径封面的补充解析。
let coverMap = new Map();
try {
	// import.meta.glob 由 Vite 在构建期解析
	const assets = import.meta.glob(
		"/src/content/posts/**/*.{png,jpg,jpeg,webp,gif,svg,avif}",
		{
			eager: true,
			import: "default",
		},
	);
	for (const [p, url] of Object.entries(assets)) {
		coverMap.set(path.basename(p), url);
	}
} catch (_e) {
	coverMap = new Map();
}

// ─── 极简 frontmatter 解析（仅取卡片所需字段）──────────────────────
function parseFrontmatter(content) {
	const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) return {};
	const lines = m[1].split(/\r?\n/);
	const data = {};
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const km = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
		if (!km) continue;
		const key = km[1];
		const val = km[2];
		if (val === "") {
			// 块级数组：tags: \n - a \n - b
			const arr = [];
			let j = i + 1;
			while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
				arr.push(lines[j].replace(/^\s*-\s+/, "").replace(/^["']|["']$/g, ""));
				j++;
			}
			if (arr.length) {
				data[key] = arr;
				i = j - 1;
				continue;
			}
			data[key] = undefined;
			continue;
		}
		if (val.startsWith("[") && val.endsWith("]")) {
			const inner = val.slice(1, -1).trim();
			data[key] = inner
				? inner
						.split(",")
						.map((s) => s.trim().replace(/^["']|["']$/g, ""))
						.filter(Boolean)
				: [];
			continue;
		}
		data[key] = val.replace(/^["']|["']$/g, "");
	}
	return data;
}

function walkDir(dir) {
	const out = [];
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...walkDir(p));
		else if (/\.(md|markdown|mdx)$/i.test(e.name)) out.push(p);
	}
	return out;
}

function removeExt(p) {
	return p.replace(/\.(md|markdown|mdx)$/i, "");
}

// ─── 构建 slug -> 文章元数据 索引（模块加载时执行一次）──────────────
const postIndex = new Map();
(function buildIndex() {
	if (!fs.existsSync(POSTS_DIR)) return;
	for (const f of walkDir(POSTS_DIR)) {
		let content = "";
		try {
			content = fs.readFileSync(f, "utf8");
		} catch {
			continue;
		}
		const fm = parseFrontmatter(content);
		const slug = removeExt(path.relative(POSTS_DIR, f).replace(/\\/g, "/"));
		const alias = fm.alias;
		const canonical = alias
			? `/posts/${encodeURIComponent(alias)}/`
			: `/posts/${encodeURIComponent(slug)}/`;
		const entry = {
			slug,
			title: fm.title || slug,
			description: fm.description || fm.aiSummary || "",
			published: fm.published || "",
			tags: Array.isArray(fm.tags) ? fm.tags : [],
			category: fm.category || "",
			image: fm.image || "",
			path: canonical,
		};
		postIndex.set(slug, entry);
		if (alias) postIndex.set(alias, entry);
	}
})();

// ─── 工具函数 ─────────────────────────────────────────────────────
// 用 mdast 节点（paragraph 配合 hName）构造任意 HTML 元素，
// 这样 remark-rehype 会直接转换为 hast 元素，无需 rehype-raw。
function el(name, props, children) {
	return {
		type: "paragraph",
		data: { hName: name, hProperties: props || {} },
		children: children?.length ? children : [{ type: "text", value: "" }],
	};
}

// 生成标题锚点 slug（与 rehype-slug / github-slugger 近似）
function slugifyHeading(text) {
	return String(text)
		.trim()
		.toLowerCase()
		.replace(/[^\w一-龥\s-]/g, "")
		.replace(/\s+/g, "-");
}

function resolveCover(img) {
	if (!img) return "";
	if (/^(https?:)?\/\//.test(img)) return img;
	if (img.startsWith("/")) return img;
	const base = path.basename(img);
	if (coverMap.has(base)) return coverMap.get(base);
	return "";
}

const WIKILINK_RE = /(?<!!)\[\[([^\]\n]+?)\]\]/g;

function parseInner(inner) {
	const pipe = inner.indexOf("|");
	let target;
	let alias = "";
	if (pipe >= 0) {
		target = inner.slice(0, pipe);
		alias = inner.slice(pipe + 1);
	} else {
		target = inner;
	}
	return { target: target.trim(), alias: alias.trim() };
}

function lookup(article) {
	return postIndex.get(article) || postIndex.get(decodeURIComponent(article));
}

// 生成行内链接节点（mdast link）
function makeLinkNode({ target, alias }) {
	const hashIdx = target.indexOf("#");
	let article = hashIdx >= 0 ? target.slice(0, hashIdx) : target;
	const heading = hashIdx >= 0 ? target.slice(hashIdx + 1) : "";
	article = article.trim();
	const headingSlug = heading.trim() ? slugifyHeading(heading.trim()) : "";

	if (!article) {
		// 同页标题锚点 [[#标题]]
		return {
			type: "link",
			url: `#${headingSlug}`,
			data: { hProperties: { class: "wiki-link wiki-link-anchor" } },
			children: [{ type: "text", value: alias || heading.trim() }],
		};
	}

	const entry = lookup(article);
	let href = entry ? entry.path : `/posts/${encodeURIComponent(article)}/`;
	if (headingSlug) href += `#${headingSlug}`;

	let text = alias;
	if (!alias || alias === article) {
		text = entry ? entry.title : article;
	}
	const cls = entry ? "wiki-link" : "wiki-link wiki-link-broken";
	return {
		type: "link",
		url: href,
		data: {
			hProperties: entry ? { class: cls } : { class: cls, title: "文章未找到" },
		},
		children: [{ type: "text", value: text }],
	};
}

// 生成单独成段的文章卡片（mdast 结构，hName 强制为 div 等元素）
function makeCardNode({ target }) {
	const hashIdx = target.indexOf("#");
	const article = (hashIdx >= 0 ? target.slice(0, hashIdx) : target).trim();
	if (!article) return null; // 同页锚点不能做卡片
	const entry = lookup(article);
	if (!entry) return null; // 找不到目标时回退为行内链接

	const href = entry.path;
	const cover = resolveCover(entry.image);
	const title = entry.title;
	const desc = entry.description || "";
	const date = entry.published ? String(entry.published) : "";
	const cat = entry.category || "";
	const tags = entry.tags;

	const coverNode = cover
		? el("div", {
				class: "wiki-card-cover",
				style: `background-image:url('${cover.replace(/'/g, "%27")}')`,
			})
		: null;

	const titleNode = el("div", { class: "wiki-card-title" }, [
		{ type: "text", value: title },
	]);

	const descNode = desc
		? el("div", { class: "wiki-card-desc" }, [{ type: "text", value: desc }])
		: null;

	const metaChildren = [];
	if (date) {
		metaChildren.push(
			el("span", { class: "wiki-card-date" }, [{ type: "text", value: date }]),
		);
	}
	if (cat) {
		metaChildren.push(
			el("span", { class: "wiki-card-cat" }, [{ type: "text", value: cat }]),
		);
	}
	if (tags.length) {
		metaChildren.push(
			el(
				"span",
				{ class: "wiki-card-tags" },
				tags.map((t) =>
					el("span", { class: "wiki-card-tag" }, [{ type: "text", value: t }]),
				),
			),
		);
	}
	const metaNode = metaChildren.length
		? el("div", { class: "wiki-card-meta" }, metaChildren)
		: null;

	const bodyChildren = [titleNode];
	if (descNode) bodyChildren.push(descNode);
	if (metaNode) bodyChildren.push(metaNode);
	const bodyNode = el("div", { class: "wiki-card-body" }, bodyChildren);

	const linkChildren = [];
	if (coverNode) linkChildren.push(coverNode);
	linkChildren.push(bodyNode);

	const linkNode = {
		type: "link",
		url: href,
		data: { hProperties: { class: "wiki-card-link" } },
		children: linkChildren,
	};

	return el("div", { class: "wiki-card card-base" }, [linkNode]);
}

// 将文本中的 [[...]] 拆分为 text / link 节点序列
function splitText(value) {
	WIKILINK_RE.lastIndex = 0;
	if (!WIKILINK_RE.test(value)) return [{ type: "text", value }];
	WIKILINK_RE.lastIndex = 0;
	const out = [];
	let last = 0;
	let m = WIKILINK_RE.exec(value);
	while (m) {
		if (m.index > last)
			out.push({ type: "text", value: value.slice(last, m.index) });
		out.push(makeLinkNode(parseInner(m[1])));
		last = m.index + m[0].length;
		m = WIKILINK_RE.exec(value);
	}
	if (last < value.length) out.push({ type: "text", value: value.slice(last) });
	return out;
}

// 处理一组子节点中的文本（行内模式，不做卡片）
function processInline(nodes) {
	const out = [];
	for (const n of nodes) {
		if (n.type === "text") {
			out.push(...splitText(n.value));
		} else if (n.children) {
			n.children = processInline(n.children);
			out.push(n);
		} else {
			out.push(n);
		}
	}
	return out;
}

// 递归遍历，区分「单独成段卡片」与「行内链接」
function walk(tree) {
	const children = tree.children;
	if (!children) return;
	const newChildren = [];
	for (const child of children) {
		if (child.type === "paragraph") {
			// 单独成段：仅一个 text 子节点且整段恰好是一个 wiki link
			if (child.children.length === 1 && child.children[0].type === "text") {
				const tv = child.children[0].value.trim();
				const solo = tv.match(/^\[\[([^\]\n]+)\]\]$/);
				if (solo) {
					const card = makeCardNode(parseInner(solo[1]));
					if (card) {
						newChildren.push(card);
						continue;
					}
				}
			}
			child.children = processInline(child.children);
			newChildren.push(child);
		} else if (child.type === "text") {
			newChildren.push(...splitText(child.value));
		} else {
			walk(child);
			newChildren.push(child);
		}
	}
	tree.children = newChildren;
}

export function remarkWikiLink() {
	return (tree) => {
		walk(tree);
	};
}

export default remarkWikiLink;
