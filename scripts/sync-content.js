import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "./load-env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

loadEnv();
console.log("已加载 .env 配置文件\n");

// 从环境变量读取配置
const ENABLE_CONTENT_SYNC = process.env.ENABLE_CONTENT_SYNC !== "false"; // 默认启用
const CONTENT_REPO_URL = process.env.CONTENT_REPO_URL || "";
const CONTENT_DIR = process.env.CONTENT_DIR || path.join(rootDir, "content");

// 内容仓库已于 2026-10-03 转为私有仓，匿名 clone/fetch 会 401。
// 凭据优先级：CONTENT_REPO_TOKEN（专用）→ GH_TOKEN（与在线编辑器共用同一个 PAT）。
// 两者都没有时退化为匿名访问；此时若仓库是私有的，下方 clone 失败会给出明确指引。
const CONTENT_REPO_TOKEN = (
	process.env.CONTENT_REPO_TOKEN ||
	process.env.GH_TOKEN ||
""
).trim();

/**
 * 为 git 命令注入 https 读取凭据。
 *
 * 用 `git -c http.https://github.com/.extraheader=AUTHORIZATION: basic <b64>`
 * 而不是把 token 拼进 remote URL：前者不会把 token 落盘到 content/.git/config，
 * 而后者会（本地开发时 content/ 是常驻目录，且该目录不在 .gitignore 的忽略范围内
 * 对 remote URL 生效）。
 *
 * 仅对 https 远程生效；SSH 形式的 URL 走 ssh key，不注入。
 */
function gitAuthArgs() {
	if (!CONTENT_REPO_TOKEN) return "";
	if (!/^https:\/\//i.test(CONTENT_REPO_URL)) return "";
	const basic = Buffer.from(`x-access-token:${CONTENT_REPO_TOKEN}`).toString(
		"base64",
	);
	return `-c "http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}" `;
}

function privateRepoHint() {
	if (CONTENT_REPO_TOKEN) return "";
	return [
		"",
		"  ⚠️ 未配置 CONTENT_REPO_TOKEN / GH_TOKEN，将以匿名方式访问内容仓库。",
		"     若内容仓库已转为私有，clone 会因 401 失败。",
		"     请在 Vercel 项目 Environment Variables 添加 CONTENT_REPO_TOKEN，",
		"     值填一个对该私有仓有 Contents: Read 权限的 GitHub PAT。",
	].join("\n");
}

console.log("开始同步内容...\n");

// 检查是否启用内容分离
if (!ENABLE_CONTENT_SYNC) {
	console.log("内容分离功能已关闭（ENABLE_CONTENT_SYNC=false）");
	console.log("提示：将使用本地内容，不会从远程仓库同步");
	console.log("      若要启用内容分离，请在 .env 中设置：");
	console.log("      ENABLE_CONTENT_SYNC=true");
	console.log("      CONTENT_REPO_URL=<your-repo-url>\n");
	process.exit(0);
}

// 检查内容目录是否存在
if (!fs.existsSync(CONTENT_DIR)) {
	console.log(`内容目录不存在：${CONTENT_DIR}`);
	console.log("将使用独立仓库模式");

	if (!CONTENT_REPO_URL) {
		console.warn("警告：未设置 CONTENT_REPO_URL，将使用本地内容");
		console.log(
			"提示：请设置 CONTENT_REPO_URL 环境变量，或手动创建内容目录",
		);
		process.exit(0);
	}

	try {
		console.log(
			`正在克隆内容仓库：${CONTENT_REPO_URL}` +
				(CONTENT_REPO_TOKEN ? "（已注入凭据）" : "（匿名）"),
		);
		execSync(
			`git ${gitAuthArgs()}clone --depth 1 ${CONTENT_REPO_URL} ${CONTENT_DIR}`,
			{
				stdio: "inherit",
				cwd: rootDir,
			},
		);
		console.log("内容仓库克隆成功");
	} catch (error) {
		console.error("克隆失败：", error.message);
		console.error(privateRepoHint());
		process.exit(1);
	}
} else {
	console.log(`内容目录已存在：${CONTENT_DIR}`);

	if (fs.existsSync(path.join(CONTENT_DIR, ".git"))) {
		try {
			console.log("正在同步远程内容（强制模式）...");

			// 1. 防止本地修改丢失
			execSync("git stash push --include-untracked -m 'auto-sync'", {
				stdio: "inherit",
				cwd: CONTENT_DIR,
			});

			// 2. 更新远程引用（私有仓需注入凭据；token 不落盘到 .git/config）
			execSync(`git ${gitAuthArgs()}fetch --all --prune`, {
				stdio: "inherit",
				cwd: CONTENT_DIR,
			});

			// 3. 判断分支
			let branch = "main";
			try {
				execSync("git rev-parse --verify origin/main", { cwd: CONTENT_DIR });
			} catch {
				branch = "master";
			}

			// 4. 强制同步
		execSync(`git checkout ${branch}`, { cwd: CONTENT_DIR });
		execSync(`git reset --hard origin/${branch}`, { cwd: CONTENT_DIR });

		console.log(`内容同步成功（分支：${branch}）`);
		} catch (error) {
			console.warn("内容更新失败：", error.message);
		}
	}
}

// 创建符号链接或复制内容
console.log("\n正在建立内容链接...");

// 内容仓库 -> 站点目录的映射
// src 是候选路径数组，按顺序取第一个真实存在的那个：
//   - 新布局（2026-10-03 起）：内容仓库收敛到 content/ 下，见「内容与框架分离」重构
//   - 旧布局：posts/ spec/ data/ images/ 直接平铺在内容仓库根目录
// dest 路径在两种布局下完全一致，因此 Astro 侧（content collections、import）无需任何改动，
// 这也是新旧布局可以平滑切换而不产生破坏的关键。
const contentMappings = [
	{ src: ["content/posts", "posts"], dest: "src/content/posts" },
	{ src: ["content/spec", "spec"], dest: "src/content/spec" },
	{ src: ["content/data", "data"], dest: "src/data" },
	{ src: ["content/images", "images"], dest: "public/images" },
	// 可编辑配置（站点名/头像/导航/首屏/评论/音乐…）。
	// 由 src/config/*.ts 里的薄 Provider 静态 import，详见 src/config/_settings.ts。
	{ src: ["content/settings", "settings"], dest: "src/settings" },
	// 可下载附件（PPT 原件 / PDF 等）。与 content/images 分开：
	// images 面向文章插图（会被 Astro 图片优化），assets 面向原样分发的二进制文件。
	{ src: ["content/assets", "assets"], dest: "public/assets" },
];

const resolved = [];
const missed = [];

for (const mapping of contentMappings) {
	// 兼容新旧两种内容仓库布局：content/<name> 优先，退回 <name>
	let srcPath = null;
	let srcRel = null;
	for (const candidate of mapping.src) {
		const candidatePath = path.join(CONTENT_DIR, candidate);
		if (fs.existsSync(candidatePath)) {
			srcPath = candidatePath;
			srcRel = candidate;
			break;
		}
	}

	if (!srcPath) {
		console.log(`跳过不存在的源目录：${mapping.src.join(" | ")}`);
		missed.push(mapping);
		continue;
	}
	resolved.push({ mapping, srcRel });

	const destPath = path.join(rootDir, mapping.dest);

	// 如果目标已存在且不是符号链接,备份它
	if (fs.existsSync(destPath) && !fs.lstatSync(destPath).isSymbolicLink()) {
		const backupPath = `${destPath}.backup`;
		console.log(
			`正在备份已有内容：${mapping.dest} -> ${mapping.dest}.backup`,
		);
		if (fs.existsSync(backupPath)) {
			fs.rmSync(backupPath, { recursive: true, force: true });
		}
		fs.renameSync(destPath, backupPath);
	}

	// 删除现有的符号链接
	if (fs.existsSync(destPath)) {
		fs.unlinkSync(destPath);
	}

	// 创建符号链接 (Windows 需要管理员权限,否则复制文件)
	try {
		const relPath = path.relative(path.dirname(destPath), srcPath);
		fs.symlinkSync(relPath, destPath, "junction");
		console.log(`已创建符号链接：${mapping.dest} -> ${srcRel}`);
	} catch (error) {
		console.log(`符号链接失败，改为复制内容：${srcRel} -> ${mapping.dest}`);
		copyRecursive(srcPath, destPath);
	}
}

// 诊断：一个都没映射上时，把内容仓库的实际顶层结构打印出来，
// 便于一眼看出是目录改名了还是克隆失败，而不是得到一个"悄悄空掉"的博客。
if (resolved.length === 0 && missed.length > 0) {
	console.warn(
		"\n⚠️ 没有任何内容目录被映射成功，站点将构建出一个空博客。内容仓库顶层实际内容：",
	);
	try {
		const top = fs.readdirSync(CONTENT_DIR, { withFileTypes: true });
		top.forEach((d) => console.warn(`    ${d.isDirectory() ? "[dir] " : "[file]"} ${d.name}`));
	} catch (error) {
		console.warn(`    无法读取 ${CONTENT_DIR}：${error.message}`);
	}
	// 硬失败：package.json 的 prebuild 是 `sync-content.js || true`，
	// 空映射会被 `|| true` 吞掉，构建照常产出「空博客」并静默上线——
	// 表现为「文章全没了」且没有任何报错，是最难排查的失败模式。
	// 这里主动 exit 1，让构建红掉：内容没进来就不该产出可上线产物。
	if (ENABLE_CONTENT_SYNC) {
		console.error(
			"\n❌ 内容同步失败：0 个内容目录被映射。终止构建，避免上线空博客。",
		);
		console.error(privateRepoHint());
		process.exit(1);
	}
}

if (resolved.length > 0) {
	console.log(
		`\n已映射 ${resolved.length}/${contentMappings.length} 项：` +
			resolved.map((r) => `${r.mapping.dest} <- ${r.srcRel}`).join("，"),
	);
}

console.log("\n内容同步完成\n");
// CI 环境下不同步回写站点仓库：同步进来的内容已被 .gitignore 忽略，
// 且 CI runner 通常没有 git 身份，git commit 会直接失败并中断整个构建。
// 本地开发仍保留 auto-commit 习惯（便于记录本次同步了哪个内容 commit）。
const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
if (isCI) {
	console.log("检测到 CI 环境，跳过站点仓库 auto-commit（内容已同步，无需回写）");
} else {
	try {
		// 兜底：若本地未配置 git 身份，先设置，避免 commit 失败
		try {
			execSync("git config user.email", { cwd: rootDir, stdio: "ignore" });
		} catch {
			execSync('git config user.email "content-sync@local"', { cwd: rootDir });
			execSync('git config user.name "content-sync"', { cwd: rootDir });
		}

		// 1. 获取 content 分支名
		const branch = execSync("git rev-parse --abbrev-ref HEAD", {
			cwd: CONTENT_DIR,
		})
			.toString()
			.trim();

		// 2. 获取 content commit hash（短）
		const hash = execSync("git rev-parse --short HEAD", {
			cwd: CONTENT_DIR,
		})
			.toString()
			.trim();

		// 3. 提交主仓库
		execSync("git add .", { cwd: rootDir });

		execSync(`git commit -m "chore(content): sync ${branch}@${hash}"`, {
			cwd: rootDir,
		});

		console.log(`已提交内容更新（${branch}@${hash}）`);
	} catch {
		console.log("没有变化，跳过提交");
	}
}

// 递归复制函数
function copyRecursive(src, dest) {
	if (fs.statSync(src).isDirectory()) {
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}
		const files = fs.readdirSync(src);
		for (const file of files) {
			copyRecursive(path.join(src, file), path.join(dest, file));
		}
	} else {
		fs.copyFileSync(src, dest);
	}
}
