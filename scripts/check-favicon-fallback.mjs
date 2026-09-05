import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import https from "node:https";

const file = process.argv[2] || "../yujingblog-content-master/yujingblog-content-master/data/website.ts";
const src = readFileSync(file, "utf-8");

function getImgurlDomain(imgurl) {
	const m = imgurl.match(/https:\/\/a\.favicon\.im\/(.+?)(?:\?|$)/);
	return m ? m[1] : "";
}

function fetchBuf(url, headers = {}) {
	return new Promise((resolve) => {
		https
			.get(url, { timeout: 15000, headers }, (res) => {
				const chunks = [];
				res.on("data", (c) => chunks.push(c));
				res.on("end", () => resolve(Buffer.concat(chunks)));
			})
			.on("error", () => resolve(Buffer.alloc(0)));
	});
}

function sha256(buf) {
	return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

async function main() {
	const rows = [];
	const re = /\{ title: "([^"]+)", imgurl: "([^"]+)", desc: "([^"]*)", siteurl: "([^"]+)", category: "([^"]+)" \}/g;
	let m;
	while ((m = re.exec(src))) {
		rows.push({ title: m[1], imgurl: m[2], siteurl: m[4], category: m[5] });
	}
	console.log(`Total ${rows.length} items`);

	const headers = {
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
		"Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
	};

	for (const item of rows) {
		const buf = await fetchBuf(item.imgurl, headers);
		const isHtml = buf.toString("utf-8", 0, 20).toLowerCase().startsWith("<!doctype") || buf.toString("utf-8", 0, 20).toLowerCase().startsWith("<html");
		console.log(`${item.title}: ${isHtml ? "HTML" : "IMG"} size=${buf.length} sha=${sha256(buf)} url=${item.imgurl}`);
	}
}

main();
