/**
 * 表情库（OwO 格式）——与文章评论区同源
 *
 * 设计原则：不写死任何表情源，一切跟随 Twikoo 服务端配置。
 * 文章评论区用的是 Twikoo 官方 SDK，其 initOwo() 逻辑为：
 *   initOwoEmotions(config.EMOTION_CDN || "https://owo.imaegoo.com/owo.json")
 * 留言板走同一份 GET_CONFIG，因此站长在 Twikoo 后台改表情包，两处同步生效。
 *
 * owo.json 是**对象**（不是数组）：
 * {
 *   "颜文字": { "type": "emoticon", "container": [ { "icon": "OωO", "text": "Author: DIYgod" } ] },
 *   "<img src='.../doge.gif'>": { "type": "image", "container": [ { "text": "doge", "icon": "<img src='...'>" } ] }
 * }
 * 顶层 key 既是分组名，也可能是一段 <img> HTML（当作分组标签图标用）。
 *
 * 短码格式与官方 marked owo 扩展保持一致（`:key:`，正则 /^:(\S*):/），
 * 保证评论区与留言板互发的表情都能正确渲染成图片。
 */

/** 官方未配置 EMOTION_CDN 时的默认值（与 SDK 内的兜底地址一致） */
const FALLBACK_EMOTION_CDN = "https://owo.imaegoo.com/owo.json";

/**
 * 服务端下发的表情 CDN（来自 GET_CONFIG 的 EMOTION_CDN）。
 * 留言列表渲染历史留言时会调用无参的 loadEmojiPacks() 预热缓存，
 * 此时应沿用服务端配置，而不是默认的 owo.imaegoo.com，
 * 否则评论区与留言板用到的短码映射会不一致，导致表情渲染不出来。
 */
let serverEmotionCdn = "";
export function setEmotionCdn(cdn?: string) {
	serverEmotionCdn = (cdn || "").trim();
}

export interface EmojiItem {
	/** 短码 key：插入输入框时写作 `:text:` */
	text: string;
	/** 原始 icon：图片型是 `<img>` HTML，文本型（颜文字 / Emoji）是字符本身 */
	icon: string;
	/** 图片型的图片地址；文本型为空串 */
	src: string;
}

export interface EmojiPack {
	/** 分组原始 key（可能是一段 HTML） */
	name: string;
	/** 分组标签图标地址：key 是 `<img>` 时提取所得，否则空串 */
	tabSrc: string;
	/** 分组标签文字：key 不是 `<img>` 时使用（如「颜文字」「Emoji」） */
	tabText: string;
	/** 官方 type：emoticon / emoji / image */
	type: string;
	items: EmojiItem[];
}

/** owo.json 原始分组结构 */
interface RawPack {
	type?: string;
	container?: { text?: string; icon?: string }[];
}

interface EmojiCache {
	packs: EmojiPack[];
	/** 短码 key → 图片地址，对应官方 initMarkedOwo 产出的 odata */
	byKey: Map<string, string>;
}

let cache: EmojiCache | null = null;
let cacheSource = "";
let inflight: Promise<EmojiCache> | null = null;

/**
 * 从 icon HTML 中取出图片地址。
 * 官方用 `template.content.childNodes[0].src` 解析，此处改用正则：
 * 结果等价，且不依赖 DOM，服务端渲染阶段调用也不会抛错。
 */
function extractSrc(icon: string): string {
	if (typeof icon !== "string" || !icon.includes("<img")) return "";
	const matched = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/iu.exec(icon);
	return matched?.[1] ?? matched?.[2] ?? "";
}

/** 取 URL 的文件名，对应官方 `e.split("#").shift().split("?").shift().split("/").pop()` */
function fileNameFromUrl(url: string): string {
	return url.split("#")[0].split("?")[0].split("/").pop() ?? "";
}

/** 只允许 http/https/协议相对/站内绝对路径，挡掉 javascript: 之类 */
function isSafeSrc(src: string): boolean {
	return /^(https?:)?\/\//iu.test(src) || src.startsWith("/");
}

function escapeHtmlAttribute(value: string): string {
	return value
		.replace(/&/gu, "&amp;")
		.replace(/"/gu, "&quot;")
		.replace(/</gu, "&lt;")
		.replace(/>/gu, "&gt;");
}

function parsePacks(raw: unknown): EmojiPack[] {
	if (!raw || typeof raw !== "object") return [];
	const packs: EmojiPack[] = [];
	for (const [name, value] of Object.entries(raw as Record<string, RawPack>)) {
		const type = typeof value?.type === "string" ? value.type : "";
		const items: EmojiItem[] = [];
		for (const entry of value?.container ?? []) {
			const icon = typeof entry?.icon === "string" ? entry.icon : "";
			if (!icon) continue;
			const src = extractSrc(icon);
			// 官方：image 类型缺 text 时用文件名补齐，使短码始终可用
			const text =
				(typeof entry?.text === "string" ? entry.text.trim() : "") ||
				(src ? fileNameFromUrl(src) : "");
			if (src && !isSafeSrc(src)) continue;
			if (src && !text) continue;
			items.push({ text, icon, src });
		}
		if (items.length === 0) continue;
		const tabSrc = extractSrc(name);
		packs.push({
			name,
			tabSrc: isSafeSrc(tabSrc) ? tabSrc : "",
			tabText: tabSrc ? "" : name,
			type,
			items,
		});
	}
	return packs;
}

function buildIndex(packs: EmojiPack[]): Map<string, string> {
	const byKey = new Map<string, string>();
	for (const pack of packs) {
		for (const item of pack.items) {
			// 与官方 initMarkedOwo 一致：只有解析出图片地址的条目进映射，
			// 颜文字 / Emoji 本身就是字符，无需短码翻译
			if (item.src && item.text) byKey.set(item.text, item.src);
		}
	}
	return byKey;
}

/**
 * 拉取并解析表情数据。
 * `cdn` 支持逗号分隔的多个地址（官方同样支持），按顺序合并，后者覆盖同名分组。
 * 结果在页面生命周期内缓存；地址变化或加载失败时会重新拉取。
 */
export async function loadEmojiPacks(cdn?: string): Promise<EmojiPack[]> {
	const source = (cdn || serverEmotionCdn || "").trim() || FALLBACK_EMOTION_CDN;
	if (cache && cacheSource === source) return cache.packs;
	if (inflight && cacheSource === source) return (await inflight).packs;

	cacheSource = source;
	inflight = (async () => {
		const urls = source
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
		const results = await Promise.all(
			urls.map(async (url) => {
				const response = await fetch(url, { cache: "force-cache" });
				if (!response.ok) {
					throw new Error(`表情包加载失败 (${response.status})`);
				}
				return parsePacks(await response.json());
			}),
		);
		const packs = results.flat();
		const parsed: EmojiCache = { packs, byKey: buildIndex(packs) };
		cache = parsed;
		return parsed;
	})();

	try {
		return (await inflight).packs;
	} catch (error) {
		// 允许下次重试
		cache = null;
		cacheSource = "";
		throw error;
	} finally {
		inflight = null;
	}
}

/** 已加载的短码映射（未加载时为空） */
export function getEmojiUrl(key: string): string | undefined {
	return cache?.byKey.get(key);
}

/**
 * 把正文里的 `:key:` 短码替换成 `<img>`。
 *
 * 与官方 marked owo 扩展等价：
 *   tokenizer  /^:(\S*):/
 *   renderer   odata[key] ? `<img class="tk-owo-emotion" src="...">` : `:key:`
 * 即：命中表情才替换，未命中原样保留。
 * 输出带 `title="emoji"`，留言板样式据此把表情按行内小图渲染（见 guestbook-chat.css）。
 *
 * 表情未加载完成时（如首屏渲染历史留言）映射为空，直接原样返回，
 * 待 loadEmojiPacks 完成后重新渲染即可显示。
 */
export function convertEmojiShortcodes(
	text: string,
	byKey?: Map<string, string>,
): string {
	const map = byKey ?? cache?.byKey;
	if (!map || map.size === 0) return text;
	return text.replace(/:(\S*):/gu, (match, key: string) => {
		const src = map.get(key);
		if (!src) return match;
		return `<img class="tk-owo-emotion" src="${escapeHtmlAttribute(src)}" alt=":${escapeHtmlAttribute(key)}:" title="emoji">`;
	});
}

/** 测试用：清空缓存 */
export function _resetEmojiCache() {
	cache = null;
	cacheSource = "";
}
