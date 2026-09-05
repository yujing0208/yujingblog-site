import https from "node:https";

const domains = ["www.agedm.io", "zh.kid1412.by", "www.hfyz.net"];
const sources = [
	(d) => `https://a.favicon.im/${d}`,
	(d) => `https://www.google.com/s2/favicons?domain=${d}&sz=128`,
	(d) => `https://icons.duckduckgo.com/ip3/${d}.ico`,
	(d) => `https://api.faviconkit.com/${d}/144`,
];

function fetch(u) {
	return new Promise((resolve) => {
		https
			.get(u, { headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" }, timeout: 15000 }, (res) => {
				const chunks = [];
				res.on("data", (c) => chunks.push(c));
				res.on("end", () => {
					const b = Buffer.concat(chunks);
					const txt = b.toString("utf8", 0, 60);
					const isSvg = txt.includes("<svg");
					const isFallback = isSvg && b.length < 400;
					const isIco = b.slice(0, 4).toString("hex") === "00000100";
					const isPng = b.slice(0, 8).toString("hex").startsWith("89504e47");
					console.log(`  ${u} → size=${b.length} svg=${isSvg} ico=${isIco} png=${isPng} fallback=${isFallback}`);
					resolve();
				});
			})
			.on("error", (e) => {
				console.log(`  ${u} → ERR ${e.message}`);
				resolve();
			});
	});
}

(async () => {
	for (const d of domains) {
		console.log(`--- ${d}`);
		for (const s of sources) {
			await fetch(s(d));
		}
	}
})();
