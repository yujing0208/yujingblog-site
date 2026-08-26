import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// 容错归一化层：内容仓库的文章 frontmatter 由在线编辑器 / Obsidian 维护，经常出现
// 类型不规范的写法（如裸 `image:` 被 YAML 解析为 null/object、`tags:` 写成字符串、
// `password:` 写成数字等）。一旦某篇不合规，astro build 会整体中断、部署失败。
// 这里用 z.preprocess 在入库前把脏值强制归一化，保证单篇文章再也不会拖垮全站。
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
const toDateOpt = z.preprocess(
	(v) => (v == null || v === "" ? undefined : v),
	z.date().optional(),
);

const postsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
	schema: z.object({
		title: toStr,
		published: z.date(),
		updated: toDateOpt,
		draft: toBool,
		description: toStrOpt,
		aiSummary: toStrOpt, // 文章页「AI 摘要」卡片文案（独立于 description：description 用于首页列表摘要，aiSummary 用于文章顶部的人性化导语，由 scripts/generate-ai-summary.mjs 写入）
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
			),

		/* Posts alias */
		alias: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),

		/* Custom permalink - 自定义固定链接，优先级高于 alias */
		permalink: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),

		/* For internal use */
		prevTitle: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
		prevSlug: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
		nextTitle: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
		nextSlug: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
	}),
});
const specCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
	schema: z.object({}),
});
export const collections = {
	posts: postsCollection,
	spec: specCollection,
};
