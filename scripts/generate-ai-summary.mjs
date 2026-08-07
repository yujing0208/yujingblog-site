/**
 * generate-ai-summary.mjs — 为博客文章批量生成「AI 摘要」并写回 frontmatter
 *
 * 复用看板娘（api/chat.js）的 DeepSeek 配置，保持接口一致：
 *   - DeepSeek OpenAI 兼容接口
 *   - 仅处理「没有 aiSummary」的文章（除非 --overwrite）
 *   - 写回 aiSummary 字段（绝不触碰 description，description 是首页列表用的简短描述，aiSummary 是文章顶部的人性化导语）
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY   必填，DeepSeek API Key（与 Vercel 看板娘同源）
 *   DEEPSEEK_BASE_URL  可选，默认 https://api.deepseek.com/chat/completions
 *   DEEPSEEK_MODEL     可选，默认 deepseek-chat
 *   CONTENT_POSTS_DIR  可选，文章目录，默认 C:\Blog\Mizuki-Content\posts
 *
 * 用法：
 *   node scripts/generate-ai-summary.mjs                # 仅补全缺失 aiSummary 的文章
 *   node scripts/generate-ai-summary.mjs --overwrite    # 重新生成全部（覆盖已有 aiSummary）
 *   node scripts/generate-ai-summary.mjs --dry          # 只预览，不写文件
 *
 * 注意：本脚本写入的是「内容仓库」的文章（你的 Obsidian 源文件），
 *       写完后请到内容仓库 git add / commit / push，再触发主仓库同步与部署。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// 简易加载 .env（与 scripts/sync-content.js 的 loadEnv 思路一致，但不依赖额外包）
try {
	const envPath = path.join(rootDir, ".env");
	if (fs.existsSync(envPath)) {
		const envContent = fs.readFileSync(envPath, "utf8");
		for (const line of envContent.split("\n")) {
			const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
			if (m && !(m[1] in process.env)) {
				process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
			}
		}
	}
} catch {
	/* ignore */
}

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL =
	process.env.DEEPSEEK_BASE_URL ||
	"https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const OVERWRITE = process.argv.includes("--overwrite");
const DRY = process.argv.includes("--dry");

const POSTS_DIR =
	process.env.CONTENT_POSTS_DIR || "C:\\Blog\\Mizuki-Content\\posts";

const MAX_CONTEXT_CHARS = 2600;
const MAX_RETRIES = 2;
const REQUEST_DELAY = 600;

const SYSTEM_PROMPT = `你是一个以第一视角写作的个人博客作者，正在为读者写一段文章开头的「AI 摘要」引导语。
核心规则：
1. 输出只要一段摘要文字，不要标题、不要列表、不要套话、不要使用 Markdown。
2. 自然口语化，像博主本人在打招呼、分享，有「人味」。
3. 不堆砌概念，不像说明书，不写「本文介绍了……」这类机器腔。
4. 保留原文的情绪与语气。
5. 【最硬性约束】字数必须控制在 50 字以内（包含标点）。如果写超了 50 字，必须删减到 50 字以下再输出，宁可少几字也绝不可超。绝对不要输出超过 50 字的内容。
6. 纯正文，不要任何前缀（如「摘要：」）。`;

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

// 去除 frontmatter 与干扰符号，保留可读正文（链接保留文字）
function cleanMarkdown(md) {
	return md
		.replace(/^---[\s\S]*?---/, "") // frontmatter
		.replace(/```[\s\S]*?```/g, "［代码块］")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 图片
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // 链接保留文字
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/[*_~`>#]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function getContent(raw) {
	const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---(\r?\n[\s\S]*)$/);
	return m ? m[1] : raw;
}

function hasAiSummary(raw) {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) return true; // 无 frontmatter 视为跳过
	return /^\s*aiSummary\s*:/m.test(m[1]);
}

// 在 frontmatter 末尾插入/更新 aiSummary；description 与其它字段原样保留
function injectFrontmatter(raw, aiSummary) {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)$/);
	if (!m) return raw; // 无 frontmatter 不处理
	const [, fm, after] = m;
	const escaped = aiSummary
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"');
	const lines = fm
		.split(/\r?\n/)
		.filter((l) => !/^\s*aiSummary\s*:/i.test(l));
	lines.push(`aiSummary: "${escaped}"`);
	return `---\n${lines.join("\n")}\n---${after}`;
}

async function generateSummary(text) {
	const userMsg = `请用第一人称给下面这篇博客写一段严格 50 字以内的 AI 摘要（包含标点也不能超过 50 字，宁可少几字）：\n\n${text.slice(0, MAX_CONTEXT_CHARS)}`;
	let attempt = 0;
	while (attempt <= MAX_RETRIES) {
		try {
			const res = await fetch(BASE_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${API_KEY}`,
				},
				body: JSON.stringify({
					model: MODEL,
					temperature: 0.75,
					max_tokens: 120,
					messages: [
						{ role: "system", content: SYSTEM_PROMPT },
						{ role: "user", content: userMsg },
					],
				}),
			});
			if (!res.ok) {
				const err = await res.text();
				throw new Error(`HTTP ${res.status}: ${err}`);
			}
			const data = await res.json();
			let content = data.choices?.[0]?.message?.content?.trim() || "";
			content = content.replace(/^(摘要|总结|导语)[：:]\s*/i, "").trim();
			if (!content) throw new Error("empty content");
			return content;
		} catch (e) {
			if (attempt === MAX_RETRIES) throw e;
			attempt++;
			await sleep(1500 * attempt);
		}
	}
}

async function main() {
	if (!API_KEY) {
		console.error(
			"❌ 缺少 DEEPSEEK_API_KEY，请在 .env 中配置（与看板娘同源）。",
		);
		process.exit(1);
	}
	if (!fs.existsSync(POSTS_DIR)) {
		console.error(`❌ 文章目录不存在: ${POSTS_DIR}`);
		process.exit(1);
	}

	const files = fs
		.readdirSync(POSTS_DIR)
		.filter((f) => /\.(md|mdx)$/i.test(f));
	console.log(`🔍 扫描到 ${files.length} 篇文章，目录: ${POSTS_DIR}`);
	if (OVERWRITE) console.log("⚠️  --overwrite 模式：将覆盖已有 aiSummary");

	let done = 0;
	let skipped = 0;
	let failed = 0;

	for (const file of files) {
		const full = path.join(POSTS_DIR, file);
		const raw = fs.readFileSync(full, "utf8");
		if (hasAiSummary(raw) && !OVERWRITE) {
			skipped++;
			continue;
		}
		const text = cleanMarkdown(getContent(raw));
		if (!text) {
			skipped++;
			continue;
		}
		try {
			const summary = await generateSummary(text);
			if (DRY) {
				console.log(`\n[DRY] ${file}\n  ${summary}\n`);
			} else {
				const out = injectFrontmatter(raw, summary);
				fs.writeFileSync(full, out, "utf8");
				console.log(`✅ ${file}`);
			}
			done++;
		} catch (e) {
			console.error(`❌ ${file}: ${e.message}`);
			failed++;
		}
		await sleep(REQUEST_DELAY);
	}

	console.log(`\n完成：生成 ${done}，跳过 ${skipped}，失败 ${failed}`);
	if (done > 0 && !DRY) {
		console.log(
			"\n下一步：到内容仓库执行 git add -A && git commit && git push，再触发主仓库同步/部署。",
		);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});