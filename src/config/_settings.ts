/**
 * 「内容」与「框架」的唯一接缝。
 *
 * ══════════════════════════════════════════════════════════════
 * 这个文件在做什么
 * ══════════════════════════════════════════════════════════════
 *
 *   content/settings/<name>.ts      ← 内容仓库（可用在线编辑器改）
 *          │  sync-content.js 建 junction
 *          ▼
 *   src/settings/<name>.ts          ← 站点构建时可见
 *          │  static import
 *          ▼
 *   src/config/<name>Config.ts      ← 薄 Provider，本目录
 *          │  deepMerge(写死的常量, 内容仓的值)
 *          ▼
 *   导出成原来的名字（siteConfig / profileConfig / …）
 *
 * ══════════════════════════════════════════════════════════════
 * 为什么是「合并」而不是「直接用内容仓的值」
 * ══════════════════════════════════════════════════════════════
 *
 * 一次配置对象的字段其实来自两个不同层级：
 *
 *   L1 写死的常量 —— 不再是个「开关」，而是这个主题的事实。
 *                    比如 toc.depth、imageOptimization.formats。
 *                    它们不该出现在可编辑文件里（编了也没用），
 *                    但仍要出现在最终的 siteConfig 里，因为引用方还在读。
 *
 *   L3 可编辑的值 —— 内容仓送来的 title / subtitle / 头像 / 歌单 …
 *
 * 所以需要把两者合成同一个对象，引用方拿到的还是那个熟悉的 siteConfig，
 * 只是它的血统变了。
 */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
	!!v && typeof v === "object" && !Array.isArray(v);

/**
 * 逐层覆盖；**数组整体替换**。
 *
 * 刻意不做按索引合并 —— 半新半旧的数组（比如社交链接改了 2 条、还剩 3 条旧值）
 * 比全旧更难排查。宁可让编辑器保证送来的是完整数组。
 *
 * @param base  写死的默认值（也是内容仓文件缺字段时的回落目标）
 * @param patch 内容仓送来的值；undefined 表示「内容仓没提供」，保持 base
 */
export function deepMerge<T>(base: T, patch: unknown): T {
	if (patch === undefined) return base;
	if (!isPlainObject(patch) || !isPlainObject(base)) return patch as T;
	const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
	for (const [k, v] of Object.entries(patch)) {
		const cur = out[k];
		out[k] = isPlainObject(v) && isPlainObject(cur) ? deepMerge(cur, v) : v;
	}
	return out as T;
}
