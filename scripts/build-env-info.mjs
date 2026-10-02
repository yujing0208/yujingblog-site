// scripts/build-env-info.mjs — 构建时把关键依赖的实际解析版本写入 public/build-info.txt
// 用于诊断线上构建环境的依赖组合（尤其是 micromark-util-character）
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const req = createRequire(import.meta.url);
// pnpm 严格隔离：传递依赖需从真实运行时位置解析
// micromark-util-character 在运行时由 micromark-extension-directive 加载，须从它的位置 resolve
const subReq = createRequire(req.resolve("remark-directive"));
const extReq = createRequire(subReq.resolve("micromark-extension-directive"));
const PKGS = [
  ["micromark-util-character", extReq],
  ["micromark-extension-directive", subReq],
  ["remark-directive", req],
  ["mdast-util-directive", subReq],
  ["@astrojs/markdown-remark", req],
  ["micromark", extReq],
];

const lines = [];
lines.push("node=" + process.version);
lines.push("cwd=" + process.cwd());

for (const [name, resolver] of PKGS) {
  try {
    const entry = resolver.resolve(name);
    const dir = path.dirname(entry);
    // entry 可能是 .../index.js 或 .../dist/index.js；向上找 package.json
    let pjPath = null;
    let d = dir;
    for (let i = 0; i < 4; i++) {
      const candidate = path.join(d, "package.json");
      if (existsSync(candidate)) { pjPath = candidate; break; }
      d = path.dirname(d);
    }
    if (pjPath) {
      const pj = JSON.parse(readFileSync(pjPath, "utf8"));
      lines.push(`${name}=${pj.version} @ ${pjPath}`);
    } else {
      lines.push(`${name}=entry@${entry} (no package.json found)`);
    }
  } catch (e) {
    lines.push(`${name}=ERROR ${String(e.message).slice(0, 120)}`);
  }
}

// 直接验证 unicodePunctuation 行为（决定性检查）
try {
  const ucEntry = extReq.resolve("micromark-util-character");
  const uc = await import(pathToFileURL(ucEntry).href);
  const eq = "=".charCodeAt(0);
  const us = "_".charCodeAt(0);
  lines.push(`unicodePunctuation('=')=${uc.unicodePunctuation(eq)} (expect true w/ 2.1.x)`);
  lines.push(`unicodePunctuation('_')=${uc.unicodePunctuation(us)} (expect true)`);
} catch (e) {
  lines.push("unicodePunctuation check ERROR " + String(e.message).slice(0, 120));
}

const out = lines.join("\n") + "\n";
try {
  mkdirSync("public", { recursive: true });
  writeFileSync("public/build-info.txt", out, "utf8");
  console.log("build-info.txt written:\n" + out);
} catch (e) {
  console.log("build-info write FAILED: " + e.message);
}
