/**
 * prebuild 守门：内容同步失败时，构建必须失败。
 *
 * 背景（2026-10-03 内容仓库转私有）：
 *   原来的 prebuild 是 `node scripts/sync-content.js || true && node scripts/build-env-info.mjs`。
 *   那个 `|| true` 会在内容仓库 clone 失败（私有仓缺凭据 = 401）时吞掉退出码，
 *   构建继续往下走，产物是一个「零篇文章」的空博客，然后照常部署上线——
 *   表现是「文章全没了」，但 CI 全绿、日志只有一行 warn，最难排查。
 *
 * 行为：
 *   - CI / Vercel：内容同步失败 → 直接 exit 1，构建红掉。内容没进来就不该产出可上线产物。
 *   - 本地：仍容忍失败（没 clone 内容仓时也能跑 astro dev / astro check），
 *     但会打印醒目警告。
 *
 * 环境变量：
 *   FORCE_CONTENT_SYNC=true  强制本地也硬失败（排查构建产物问题时用）。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const isCI =
  process.env.CI === "true" ||
  process.env.GITHUB_ACTIONS === "true" ||
  process.env.VERCEL === "1" ||
  !!process.env.VERCEL_ENV;
const force = process.env.FORCE_CONTENT_SYNC === "true";

console.log(
  `[prebuild] 环境：${isCI ? "CI/Vercel（内容同步失败将中断构建）" : "本地（失败仅警告）"}`,
);

// ── 1. 跑内容同步 ──
const sync = spawnSync(process.execPath, ["scripts/sync-content.js"], {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env,
});

if (sync.status === 0) {
  console.log("[prebuild] 内容同步成功\n");
} else if (isCI || force) {
  console.error(
    "\n[prebuild] ❌ 内容同步失败，且当前是 CI / FORCE_CONTENT_SYNC 模式。",
  );
  console.error("[prebuild] 终止构建——否则会产出一个没有任何文章的「空博客」并上线。");
  console.error(
    "[prebuild] 若内容仓库已转为私有，请确认已配置 CONTENT_REPO_TOKEN 环境变量。\n",
  );
  process.exit(sync.status === 0 ? 1 : sync.status);
} else {
  // 用 console.log 而非 console.warn：prebuild 的输出常被 CI 折叠，
  // 走stdout 保证本地「同步失败但仍继续」这条信息一定可见。
  console.log(
    "[prebuild] ⚠️ 内容同步失败，但当前是本地环境，继续构建。",
  );
  console.log(
    "[prebuild]    若这是意外，请检查 content/ 是否已 clone，或设置 FORCE_CONTENT_SYNC=true。",
  );
  console.log("");
}

// ── 2. 生成构建环境信息（失败也继续，原本行为）──
const info = spawnSync(process.execPath, ["scripts/build-env-info.mjs"], {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env,
});

process.exit(info.status === 0 ? 0 : info.status || 0);
