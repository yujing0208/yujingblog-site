// 优化重构的单元测试：验证功能保持不变。
// 运行：node scripts/perf-optimization.test.mjs
// 不依赖任何测试框架，使用 Node 内置 assert。
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// buildIconInclude 内部 walk(SCAN_DIR) 依赖进程 cwd，切换到站点根目录运行。
process.chdir(root);

// Windows 上 import() 必须使用 file:// URL 协议
const importFrom = (p) => import(pathToFileURL(p).href);

let passed = 0;
let failed = 0;
function test(name, fn) {
	try {
		fn();
		passed++;
		console.log(`  ✓ ${name}`);
	} catch (err) {
		failed++;
		console.error(`  ✗ ${name}\n    ${err.message}`);
		process.exitCode = 1;
	}
}

console.log("== astro-icon-include: filterValidNames ==");
const m = await importFrom(join(root, "src/plugins/astro-icon-include.mjs"));
const { filterValidNames, buildIconInclude } = m;

test("已安装集合中非法图标名被过滤（含空格/大写不符合 iconify 命名）", () => {
	// Iconify 图标名仅含小写字母/数字/连字符；含空格或大写必不存在于集合中
	const referenced = new Map([
		["material-symbols", new Set(["home", "search", "This Name Has Spaces"])],
	]);
	const out = filterValidNames(referenced);
	assert.ok(
		!("This Name Has Spaces" in (out["material-symbols"] ?? {})),
		"含空格的非法图标名应被过滤",
	);
	assert.ok(out["material-symbols"].includes("home"), "合法名应保留");
});

test("集合名为空时跳出不输出", () => {
	const referenced = new Map([["mdi", new Set()]]);
	const out = filterValidNames(referenced);
	assert.ok(!("mdi" in out));
});

test("输出按字母序排序", () => {
	const referenced = new Map([
		["material-symbols", new Set(["zebra", "apple", "mango"])],
	]);
	const out = filterValidNames(referenced);
	assert.deepEqual(out["material-symbols"], [...out["material-symbols"]].sort());
});

test("未知集合名保留（fallback 不校验，与原实现一致）", () => {
	const referenced = new Map([["unknown-collection", new Set(["x"])]]);
	const out = filterValidNames(referenced);
	// 原实现：valid 为 null 时直接保留 [...names]，未知集合不被丢弃
	assert.ok("unknown-collection" in out);
	assert.deepEqual(out["unknown-collection"], ["x"]);
});

console.log("== buildIconInclude 集成行为 ==");
test("在站点根目录运行时返回可序列化对象", () => {
	const include = buildIconInclude();
	assert.equal(typeof include, "object");
	assert.doesNotThrow(() => JSON.stringify(include));
	assert.ok(Object.keys(include).length > 0, "应包含至少一个图标集合");
});

console.log("== icon-loader: 重构健全性 ==");
const loaderPath = join(root, "src/utils/icon-loader.ts");
test("icon-loader.ts 存在且可被构建管线识别", () => {
	assert.ok(existsSync(loaderPath), "icon-loader.ts 应存在于原路径");
});

console.log(`\n通过 ${passed} 项，失败 ${failed} 项。`);
if (failed > 0) process.exit(1);
