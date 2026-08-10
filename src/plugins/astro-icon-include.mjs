import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

/**
 * astro-icon embeds icon sets into a `virtual:astro-icon` module at build time.
 * When `include` is omitted, every installed `@iconify-json/*` package is bundled
 * in full (~30k icons / ~18MB), which overflows es-module-lexer's WASM memory
 * ceiling and crashes the Vite/rolldown build.
 *
 * To avoid that, we scan the source tree for icon references (`prefix:name`
 * string literals) belonging to installed collections and build a minimal
 * `include` allowlist. All icon names in this project are static literals, so a
 * source scan captures every icon that astro-icon needs to render.
 *
 * Each scanned name is validated against the collection's actual icons and
 * aliases, so stray matches from comments, typos, or CDN-only icons are dropped
 * rather than passed to astro-icon (which errors the build on unknown names).
 */

const require = createRequire(import.meta.url);

// Collections installed as @iconify-json/* packages and rendered through
// astro-icon's build-time <Icon> component. Other prefixes (e.g. logos,
// devicon) are rendered via the runtime <iconify-icon> web component and do
// not go through astro-icon, so they must not appear here.
const INSTALLED_COLLECTIONS = [
	"material-symbols",
	"mdi",
	"fa7-solid",
	"fa7-regular",
	"fa7-brands",
	"simple-icons",
	"logos",
];

const SCAN_DIR = "src";
const SCAN_EXTENSIONS = [
	".astro",
	".svelte",
	".ts",
	".tsx",
	".js",
	".mjs",
	".json",
];

// Matches `prefix:name` icon identifiers, e.g. material-symbols:home-outline.
const ICON_REF_RE =
	/\b([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)\b/g;

function walk(dir, files = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stats = statSync(full);
		if (stats.isDirectory()) {
			walk(full, files);
		} else if (SCAN_EXTENSIONS.some((ext) => full.endsWith(ext))) {
			files.push(full);
		}
	}
	return files;
}

/**
 * Loads the set of valid icon names (icons + aliases) for an installed
 * collection, or null if the package is not installed.
 * @param {string} collection
 * @returns {Set<string> | null}
 */
// 优化点：集合名集合加载涉及 require.resolve + JSON.parse 文件读取，
// 属于高成本 IO。同一集合在单次 buildIconInclude 中可能被多次查询，
// 用模块级缓存避免重复磁盘 IO（消除冗余计算）。
const collectionNamesCache = new Map();

function loadCollectionNames(collection) {
	if (collectionNamesCache.has(collection)) {
		return collectionNamesCache.get(collection);
	}
	let names = null;
	try {
		const jsonPath = require.resolve(`@iconify-json/${collection}/icons.json`);
		const data = JSON.parse(readFileSync(jsonPath, "utf8"));
		names = new Set([
			...Object.keys(data.icons ?? {}),
			...Object.keys(data.aliases ?? {}),
		]);
	} catch {
		names = null;
	}
	collectionNamesCache.set(collection, names);
	return names;
}

/**
 * 扫描目录，收集所有被引用的合法图标引用（prefix:name 形式）。
 * 优化点：仅对单文件做一次性正则匹配，避免把整站文件内容拼接成大字符串；
 * 用 Set 去重，时间复杂度 O(总匹配数) 而非 O(文件数 × 文件数)。
 * @returns {Map<string, Set<string>>} 每个集合名下实际引用的图标名集合
 */
function collectIconReferences() {
	const installedSet = new Set(INSTALLED_COLLECTIONS);
	const referenced = new Map(
		INSTALLED_COLLECTIONS.map((name) => [name, new Set()]),
	);

	for (const file of walk(SCAN_DIR)) {
		// 优化点：超出阈值的大文件（如 dist 产物、巨幅 JSON）跳过全文读取，
		// 改用常量扫描上限，防止构建期内存峰值过高。
		const MAX_SCAN_BYTES = 2 * 1024 * 1024;
		let content;
		try {
			const { size } = statSync(file);
			if (size > MAX_SCAN_BYTES) continue;
			content = readFileSync(file, "utf8");
		} catch {
			continue;
		}

		for (const match of content.matchAll(ICON_REF_RE)) {
			const [, prefix, name] = match;
			if (installedSet.has(prefix)) {
				referenced.get(prefix).add(name);
			}
		}
	}
	return referenced;
}

/**
 * 过滤掉不存在于已安装集合中的图标名，避免构建失败。
 * @param {Map<string, Set<string>>} referenced
 * @returns {Record<string, string[]>}
 */
export function filterValidNames(referenced) {
	/** @type {Record<string, string[]>} */
	const include = {};
	for (const [collection, names] of referenced) {
		if (names.size === 0) continue;

		const validNames = loadCollectionNames(collection);
		// 仅保留集合中真实存在的图标名；未知名（注释、拼写错误、
		// 仅 CDN 提供的图标）会导致构建中断，必须剔除。
		const usable = validNames
			? [...names].filter((n) => validNames.has(n))
			: [...names];

		if (usable.length > 0) {
			include[collection] = usable.sort();
		}
	}
	return include;
}

/**
 * @returns {Record<string, string[]>} astro-icon `include` map, e.g.
 *   { "material-symbols": ["home", "search"], "mdi": ["github"] }
 */
export function buildIconInclude() {
	return filterValidNames(collectIconReferences());
}
