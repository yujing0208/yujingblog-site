/**
 * 表情库（OwO 格式）：加载 owo.imaegoo.com 的 owo.json 并构建 key→url 索引
 *
 * 数据形态：
 *   [
 *     {
 *       type: "image",
 *       container: [
 *         { text: "微笑", icon: "https://owo.imaegoo.com/aru/1.png" },
 *         ...
 *       ]
 *     },
 *     ...
 *   ]
 *
 * 每个顶层元素即一个表情包。`text` 是用户键入的短码（去掉 `:` 后与 key 对应），
 * `icon` 是图片 URL。本模块对外暴露：
 *   - loadEmojiPacks(): 拉取并解析，模块级缓存
 *   - emojiKeyToUrl(key): 把 ":key:" 中的 key 翻译成图片 URL（用于发送前转成 markdown 图片）
 *   - convertEmojiShortcodes(text): 批量替换文本里的 ":key:" 为 "![:key:](url)"，交给 marked 渲染成 <img>
 */
export interface OwOItem {
	text: string;
	icon: string;
}
export interface OwOPack {
	/** 表情包名（用首个 item 的 text 作 fallback） */
	name: string;
	icon: string;
	items: OwOItem[];
}

/** owo.json 原始结构：每个表情包是一个 { type?, container: [{text, icon}] } */
interface OwORawPack {
	type?: string;
	container?: OwOItem[];
}

const OWO_URL = "https://owo.imaegoo.com/owo.json";
const MAX_INLINE_KEY_LENGTH = 32;

let cache: { packs: OwOPack[]; byKey: Map<string, string> } | null = null;
let inflight: Promise<{ packs: OwOPack[]; byKey: Map<string, string> }> | null = null;

function buildIndex(rawPacks: OwORawPack[]) {
	const byKey = new Map<string, string>();
	const normalized: OwOPack[] = [];
	for (const raw of rawPacks) {
		const items: OwOItem[] = [];
		for (const it of raw.container ?? []) {
			if (typeof it?.text !== "string" || typeof it?.icon !== "string") continue;
			const key = it.text.trim();
			if (!key) continue;
			items.push({ text: key, icon: it.icon });
			byKey.set(key, it.icon);
		}
		if (items.length === 0) continue;
		normalized.push({
			name: items[0]?.text ?? "表情",
			icon: items[0]?.icon ?? "",
			items,
		});
	}
	return { packs: normalized, byKey };
}

/** 拉取并解析 OwO 数据；并发安全，模块级单次加载 */
export async function loadEmojiPacks(): Promise<OwOPack[]> {
	if (cache) return cache.packs;
	if (inflight) return (await inflight).packs;
	inflight = (async () => {
		const res = await fetch(OWO_URL, { cache: "force-cache" });
		if (!res.ok) throw new Error(`表情包加载失败 (${res.status})`);
		const raw = (await res.json()) as OwORawPack[];
		const parsed = buildIndex(Array.isArray(raw) ? raw : []);
		cache = parsed;
		return parsed;
	})();
	try {
		return (await inflight).packs;
	} finally {
		inflight = null;
	}
}

export function getEmojiUrl(key: string): string | undefined {
	return cache?.byKey.get(key);
}

/**
 * 把文本里的 ":key:" 短码替换成 "![:key:](url)"，
 * 使 marked 渲染为 <img>，与已有 Twikoo 评论里的 emoji 标签保持一致。
 */
export function convertEmojiShortcodes(
	text: string,
	byKey?: Map<string, string>,
): string {
	const map = byKey ?? cache?.byKey;
	if (!map) return text;
	return text.replace(
		/:([A-Za-z0-9_\-\u4e00-\u9fa5]{1,32})/g,
		(match, key: string) => {
			const url = map.get(key);
			if (!url) return match;
			return `![${key}](${url} "emoji")`;
		},
	);
}

/** 测试用：清空缓存 */
export function _resetEmojiCache() {
	cache = null;
}