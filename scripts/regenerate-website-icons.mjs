/**
 * 根据每条网站的 siteurl，将其 imgurl 重置为 favicon.im 图片接口链接。
 * 用法：node scripts/regenerate-website-icons.mjs [website.ts 路径]
 * 默认路径：../../yujingblog-content-master/yujingblog-content-master/data/website.ts
 *
 * favicon.im 图片接口：https://a.favicon.im/<根域名>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function guessFaviconDomain(url) {
	if (!url) return "";
	let s = String(url).trim();
	s = s.replace(/^[a-zA-Z]+:\/\//, "");
	s = s.replace(/^\/+/, "");
	s = s.split("/")[0];
	s = s.split("?")[0].split("#")[0];
	if (!s) return "";
	if (s.indexOf(".") === -1) return s;
	s = s.replace(/^www\./, "");
	return s;
}

const target =
	process.argv[2] ||
	resolve(__dirname, "../../yujingblog-content-master/yujingblog-content-master/data/website.ts");

let text = readFileSync(target, "utf-8");

// 逐行处理：仅替换旧 favicon.im 接口的 imgurl；其余 imgurl 保持不变
const lines = text.split("\n");
let updated = 0;
const out = lines.map((line) => {
	const m = line.match(/imgurl:\s*"([^"]*)"/);
	if (!m) return line;
	const oldUrl = m[1];
	// 已是正确的 a.favicon.im 接口则跳过
	if (/^https:\/\/a\.favicon\.im\//.test(oldUrl)) return line;
	// 从同行的 siteurl 推断域名；若本行无 siteurl 则无法推断，保留原值
	const su = line.match(/siteurl:\s*"([^"]+)"/);
	if (!su) return line;
	const domain = guessFaviconDomain(su[1]);
	if (!domain) return line;
	const newVal = `https://a.favicon.im/${domain}`;
	const newLine = line.replace(m[0], `imgurl: "${newVal}"`);
	updated++;
	return newLine;
});

writeFileSync(target, out.join("\n"), "utf-8");
console.log(`已更新 ${target} 中 ${updated} 条网站的图标链接（favicon.im）。`);
