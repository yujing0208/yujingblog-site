import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// 容错归一化层：内容仓库的文章 frontmatter 由在线编辑器 / Obsidian 维护，经常出现
// 字段缺失或类型不规范的写法（如裸 `image:`、漏写 `published:`、`tags:` 写成字符串等）。
// 一旦某篇不合规，astro build 会整体中断、部署失败。这里用 z.preprocess 在入库前
// 把脏值强制归一化，保证单篇文章再也不会拖垮全站。
const toStr = z.preprocess(
	(v) => (v == null ? "" : Array.isArray(v) ? v.join(",") : String(v)),
	z.string(),
);
const toStrOpt = z.preprocess(
	(v) => (v == null ? "" : Array.isArray(v) ? v.join(",") : String(v)),
	z.string().optional().default(""),
);
const toArr = z.preprocess((v) => {
	if (v == null) return [];
	if (Array.isArray(v)) return v.map((x) => String(x));
	if (typeof v === "string") return v.split(/[,\s]+/).filter(Boolean);
	return [String(v)];
}, z.array(z.string()).optional().default([]));
const toBool = z.preprocess(
	(v) => (v == null ? false : v === true || v === "true" || v === "1" || v === 1),
	z.boolean().optional().default(false),
);
const toNum = z.preprocess(
	(v) => (v == null || v === "" || isNaN(Number(v)) ? undefined : Number(v)),
	z.number().optional(),
);
// published 是必填项，但内容仓库可能漏写/写成空值。空值兜底为构建时间，避免整站 build 失败。
const toDateRequired = z.preprocess((v) => {
	if (v == null || v === "" || (typeof v === "string" && isNaN(Date.parse(v)))) {
		return new Date();
	}
	return v;
}, z.date());
const toDateOpt = z.preprocess(
	(v) => (v == null || v === "" ? undefined : v),
	z.date().optional(),
);

const postsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
	schema: z
		.object({
			title: toStr,
			published: toDateRequired,
			updated: toDateOpt,
			draft: toBool,
			description: toStrOpt,
			aiSummary: toStrOpt, // 文章页「AI 摘要」卡片文案（独立于 description）
			image: toStrOpt,
			tags: toArr,
			category: toStrOpt,
			lang: toStrOpt,
			pinned: toBool,
			comment: z.preprocess(
				(v) => (v == null ? true : v === true || v === "true" || v === "1" || v === 1),
				z.boolean().optional().default(true),
			),
			priority: toNum,
			author: toStrOpt,
			sourceLink: toStrOpt,
			licenseName: toStrOpt,
			licenseUrl: toStrOpt,

			/* Page encryption fields */
			encrypted: toBool,
			password: toStrOpt,
			passwordHint: toStrOpt,
			hideHomeContent: z
				.preprocess(
					(v) => (v == null ? undefined : v === true || v === "true" || v === "1" || v === 1),
					z.boolean().optional(),
				)
				.optional(),

			/* Posts alias */
			alias: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),

			/* Custom permalink */
			permalink: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),

			/* For internal use */
			prevTitle: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
			prevSlug: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
			nextTitle: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
			nextSlug: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
		})
		// 允许 frontmatter 中出现 schema 未显式声明的额外字段（如编辑器自定义的字段），
		// 避免未知字段导致校验失败。
		.passthrough(),
});
const specCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
	schema: z.object({}).passthrough(),
});
export const collections = {
	posts: postsCollection,
	spec: specCollection,
};
