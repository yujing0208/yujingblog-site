import https from "node:https";
import http from "node:http";

const urls = [
	"https://www.agedm.io",
	"https://zh.kid1412.by",
	"http://www.hfyz.net/sy/index.html",
];

function fetchHtml(u) {
	return new Promise((resolve) => {
		const mod = u.startsWith("https:") ? https : http;
		mod
			.get(u, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 15000 }, (res) => {
				if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
					return fetchHtml(new URL(res.headers.location, u).href).then(resolve);
				}
				let data = "";
				res.setEncoding("utf8");
				res.on("data", (c) => (data += c));
				res.on("end", () => resolve(data));
			})
			.on("error", (e) => {
				console.log(`${u} ERR ${e.message}`);
				resolve("");
			});
	});
}

function resolveUrl(base, rel) {
	try {
		return new URL(rel, base).href;
	} catch {
		return rel;
	}
}

async function main() {
	for (const u of urls) {
		console.log(`--- ${u}`);
		const html = await fetchHtml(u);
		if (!html) continue;
		// 提取 icon 链接
		const matches = [
			...html.matchAll(/<link[^>]*rel=["']?(?:icon|shortcut icon|apple-touch-icon)["']?[^>]*>/gi),
		];
		for (const m of matches) {
			const tag = m[0];
			const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
			if (href) {
				console.log(`  icon: ${resolveUrl(u, href)}`);
			}
		}
		// 也尝试 /favicon.ico
		console.log(`  guess: ${new URL("/favicon.ico", u).href}`);
	}
}

main();
