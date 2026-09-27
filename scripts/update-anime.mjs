import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const CONFIG_PATH = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../src/config/siteConfig.ts",
);

async function getAnimeModeFromConfig() {
	try {
		const configContent = await fs.readFile(CONFIG_PATH, "utf-8");
		const match = configContent.match(
			/anime:\s*\{[\s\S]*?mode:\s*["']([^"']+)["']/,
		);

		if (match && match[1]) {
			return match[1];
		}
		return "bangumi";
	} catch (error) {
		return "bangumi";
	}
}

function runScript(scriptPath) {
	return new Promise((resolve, reject) => {
		const script = spawn("node", [scriptPath], {
			stdio: "inherit",
			shell: true,
		});

		script.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Script exited with code ${code}`));
			}
		});

		script.on("error", (err) => {
			reject(err);
		});
	});
}

async function main() {
	const mode = await getAnimeModeFromConfig();
	const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

	if (mode === "bilibili") {
		console.log("Detected anime mode: bilibili, running update-bilibili.mjs");
		await runScript(path.join(scriptsDir, "update-bilibili.mjs"));
	} else if (mode === "bangumi") {
		console.log("Detected anime mode: bangumi, running update-bangumi.mjs");
		await runScript(path.join(scriptsDir, "update-bangumi.mjs"));
	} else {
		console.log(`Anime mode is "${mode}", skipping data update.`);
	}
}

// 番剧数据是「可选增强」：接口来自第三方（api.bgm.tv），可能因网络/限流/服务故障不可达。
// 早期实现里这里失败会 process.exit(1)，而 build 脚本是
//   node scripts/update-anime.mjs && astro build && pagefind
// 的 && 串联，于是**一个外部 API 抖动就会让整站无法构建**
// （2026-09-27 实测：api.bgm.tv 在部分网络环境完全不可达，导致连续多次部署全部失败，
//   astro build 根本没执行）。
// 因此改为：失败仅告警并正常退出，站点继续用上一次的番剧数据构建。
main().catch((err) => {
	console.warn("\n⚠ 番剧数据更新失败，已跳过（不阻断站点构建）：");
	console.warn(err && err.message ? err.message : err);
	console.warn("  站点将继续使用已有的番剧数据。");
	process.exit(0);
});
