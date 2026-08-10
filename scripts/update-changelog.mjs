#!/usr/bin/env node
/**
 * scripts/update-changelog.mjs
 *
 * 更新日志「只读建议」模式。
 *
 * 历史说明：本脚本原本会根据 git 提交历史自动覆盖 src/config/changelog.ts。
 * 由于更新日志现在由人工维护（需要把同一功能 / 修复 / 删除的多次部署
 * 合并为一条记录，含版本号 / 分类 / 模块 / 详细描述），自动覆盖会丢失这些
 * 整理信息。因此本脚本改为「只读」：
 *   - 读取已维护的 changelog.ts，提取其中已收录的 commit 哈希；
 *   - 扫描 git 提交历史，列出尚未被任何条目覆盖的提交；
 *   - 仅向控制台打印「建议补充」清单，不写入、不提交、不推送。
 *
 * 用法: node scripts/update-changelog.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outFile = join(repoRoot, "src", "config", "changelog.ts");

/** 执行 git 命令（不经 shell，避免 Windows 管道符问题） */
function git(args, opts = {}) {
	return execFileSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["pipe", "pipe", "pipe"],
		env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
		...opts,
	}).trim();
}

/* ========== 1. 读取已维护日志中收录的 commit 哈希 ========== */
const knownHashes = new Set();
if (existsSync(outFile)) {
	const src = readFileSync(outFile, "utf8");
	const re = /commits:\s*\[([\s\S]*?)\]/g;
	let m;
	while ((m = re.exec(src))) {
		const inner = m[1];
		const hashes = inner.match(/"([0-9a-f]+)"/g) || [];
		for (const h of hashes) knownHashes.add(h.replace(/"/g, ""));
	}
}

/* ========== 2. 获取提交历史（新→旧） ========== */
let logRaw = "";
for (const branch of ["master", "main"]) {
	try {
		logRaw = git(["log", branch, "--pretty=format:%H|%ai|%s", "--no-merges"]);
		break;
	} catch {
		/* try next branch */
	}
}
if (!logRaw) {
	console.error("[update-changelog] 无法读取 git 历史");
	process.exit(1);
}

/* ========== 3. 小改动过滤规则（仅用于建议，不写入） ========== */
const SKIP_PREFIX = /^(chore|docs|style|test|build|ci|deps|refactor)(\([^)]*\))?:/i;
const SKIP_SYNC = /(^|\s)(sync\s+content|content\s+sync|同步内容|更新内容)/i;
const SKIP_KEYWORDS = [
	"typo", "错别字", "拼写", "文案", "注释", "README", "readme", "格式", "格式化",
	"重命名", "rename", "微调", "小优化", "小调整", "样式微调", "dependenc", "lockfile",
	"pnpm-lock", "package-lock", "yarn.lock", "version bump", "bump", "升级依赖",
	"更新依赖", "update navbarconfig", "favicon", "部署", "deploy", "构建", "vercel",
	"module not found", "图标集", "icon set", "类型错误", "type error", "渲染映射表",
	"移出", "移至", "emoji.ts", "OwOPack", "自动更新",
];
function isMinor(message) {
	if (SKIP_PREFIX.test(message)) return true;
	if (SKIP_SYNC.test(message)) return true;
	const lower = message.toLowerCase();
	return SKIP_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}
function classify(message) {
	const lower = message.toLowerCase();
	if (/删除|移除|remove|delete/.test(lower)) return "removal";
	if (/^feat|新增|添加|支持|加入|升级|推出/.test(lower)) return "feature";
	if (/^fix|修复|修正/.test(lower)) return "fix";
	if (/^perf|优化|提升|改进|改善/.test(lower)) return "improvement";
	return "other";
}

/* ========== 4. 比对：找出尚未收录的提交 ========== */
const suggestions = [];
for (const line of logRaw.split("\n")) {
	if (!line) continue;
	const [hash, date, ...msgParts] = line.split("|");
	const message = msgParts.join("|").trim();
	if (!message) continue;
	if (isMinor(message)) continue;
	if (knownHashes.has(hash.slice(0, 7))) continue;
	suggestions.push({
		hash: hash.slice(0, 7),
		date: date.replace(" +0800", "").slice(0, 10),
		message,
		type: classify(message),
	});
}

/* ========== 5. 仅打印建议，绝不写入 / 提交 / 推送 ========== */
console.log(
	`[update-changelog] 已收录 ${knownHashes.size} 个 commit 哈希；` +
		`待补充提交 ${suggestions.length} 条：`,
);
for (const s of suggestions) {
	console.log(`  - [${s.type}] ${s.date} ${s.hash}  ${s.message}`);
}
console.log(
	"\n[update-changelog] 维护说明：请手工将以上提交合并到 src/config/changelog.ts " +
		"（同主题的多条合并为一条）。本脚本不会修改任何文件。",
);
