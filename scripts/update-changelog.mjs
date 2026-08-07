#!/usr/bin/env node
/**
 * scripts/update-changelog.mjs
 *
 * 从 git 提交历史重新生成更新日志数据（src/config/changelog.ts）。
 * - 只保留重要更新（功能新增 / 功能优化 / 问题修复 / 功能删除），过滤小改动
 * - 有变化时自动 commit 并 push，供 Vercel 重新部署
 *
 * 用法: node scripts/update-changelog.mjs
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
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

/* ========== 1. 同步远程（尽力而为，失败不中断） ========== */
try {
	git(["fetch", "origin"]);
} catch {
	console.warn("[update-changelog] git fetch 失败，使用本地历史");
}

/* ========== 2. 获取提交历史（新→旧） ========== */
let logRaw = "";
for (const branch of ["master", "main"]) {
	try {
		logRaw = git([
			"log",
			branch,
			"--pretty=format:%H|%ai|%s",
			"--no-merges",
		]);
		break;
	} catch {
		/* try next branch */
	}
}
if (!logRaw) {
	console.error("[update-changelog] 无法读取 git 历史");
	process.exit(1);
}

/* ========== 3. 过滤规则：小改动不收录 ========== */
// 直接跳过的小改动类型前缀
const SKIP_PREFIX = /^(chore|docs|style|test|build|ci|deps|refactor)(\([^)]*\))?:/i;
// 内容同步类提交
const SKIP_SYNC = /(^|\s)(sync\s+content|content\s+sync|同步内容|更新内容)/i;
// 无用户价值的小改动关键词（命中即跳过）
const SKIP_KEYWORDS = [
	"typo",
	"错别字",
	"拼写",
	"文案",
	"注释",
	"README",
	"readme",
	"格式",
	"格式化",
	"重命名",
	"rename",
	"微调",
	"小优化",
	"小调整",
	"样式微调",
	"dependenc",
	"lockfile",
	"pnpm-lock",
	"package-lock",
	"yarn.lock",
	"version bump",
	"bump",
	"升级依赖",
	"更新依赖",
	"update navbarconfig",
	"favicon",
	"部署",
	"deploy",
	// 内部技术性改动（非用户可见）
	"构建",
	"vercel",
	"module not found",
	"图标集",
	"icon set",
	"类型错误",
	"type error",
	"渲染映射表",
	"移出",
	"移至",
	"emoji.ts",
	"OwOPack",
	"自动更新",
];

function isMinor(message) {
	if (SKIP_PREFIX.test(message)) return true;
	if (SKIP_SYNC.test(message)) return true;
	const lower = message.toLowerCase();
	return SKIP_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

/* ========== 4. 类型归类 ========== */
function classify(message) {
	const lower = message.toLowerCase();
	if (/删除|移除|remove|delete/.test(lower)) return "removal";
	if (/^feat|新增|添加|支持|加入|升级|推出/.test(lower)) return "feature";
	if (/^fix|修复|修正/.test(lower)) return "fix";
	if (/^perf|优化|提升|改进|改善/.test(lower)) return "improvement";
	return "other";
}

/* ========== 5. 生成数据 ========== */
const entries = [];
for (const line of logRaw.split("\n")) {
	if (!line) continue;
	const [hash, date, ...msgParts] = line.split("|");
	const message = msgParts.join("|").trim();
	if (!message) continue;
	if (isMinor(message)) continue;

	entries.push({
		hash: hash.slice(0, 7),
		date: date.replace(" +0800", ""),
		message: message.replace(/\\/g, "\\\\").replace(/"/g, '\\"'),
		type: classify(message),
	});
}

let out = 'import type { ChangelogItem } from "../types/changelog";\n\n';
out += "export const changelogData: ChangelogItem[] = [\n";
for (const item of entries) {
	out += "\t{\n";
	out += `\t\thash: "${item.hash}",\n`;
	out += `\t\tdate: "${item.date}",\n`;
	out += `\t\tmessage: "${item.message}",\n`;
	out += `\t\ttype: "${item.type}",\n`;
	out += "\t},\n";
}
out += "];\n";

/* ========== 6. 写入（如有变化）并推送 ========== */
const prev = existsSync(outFile) ? readFileSync(outFile, "utf8") : "";
if (prev === out) {
	console.log(`[update-changelog] 无变化（共 ${entries.length} 条重要更新）`);
} else {
	writeFileSync(outFile, out, "utf8");
	console.log(`[update-changelog] 已生成 ${entries.length} 条重要更新 -> ${outFile}`);
	try {
		git(["add", "src/config/changelog.ts"]);
		git(["commit", "-m", `chore(changelog): 每日自动更新更新日志（${entries.length} 条重要更新）`]);
		console.log("[update-changelog] 已提交");
	} catch (e) {
		console.log("[update-changelog] 提交跳过:", e.message.split("\n")[0]);
	}
}

// 推送本地未推送的提交（含历史遗留）
try {
	git(["push", "origin", "master"]);
	console.log("[update-changelog] 已推送");
} catch (e) {
	console.warn("[update-changelog] 推送失败:", e.message.split("\n")[0]);
	process.exit(1);
}
