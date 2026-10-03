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
		console.log(`正在克隆内容仓库：${CONTENT_REPO_URL}`);
		execSync(`git clone --depth 1 ${CONTENT_REPO_URL} ${CONTENT_DIR}`, {
			stdio: "inherit",
			cwd: rootDir,
		});
		console.log("内容仓库克隆成功");
	} catch (error) {
		console.error("克隆失败：", error.message);
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

			// 2. 更新远程引用
			execSync("git fetch --all --prune", {
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
