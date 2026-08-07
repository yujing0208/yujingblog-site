/**
 * md：Markdown frontmatter 解析/序列化
 * 支持文章与 spec 页面（YAML frontmatter + MD 正文）。
 * 原则：未知字段解析后保留（如 aiSummary/prevSlug 等），序列化全量写回。
 */
(function () {
	"use strict";

	/** 解析 frontmatter → { data, body }；无 frontmatter 时 body 为全文 */
	function parse(text) {
		var m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
		if (!m) return { data: {}, body: text };
		var fm = m[1];
		var data = {};
		var lines = fm.split(/\r?\n/);
		var i = 0;
		while (i < lines.length) {
			var line = lines[i];
			var mm = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
			if (mm) {
				var k = mm[1];
				var raw = mm[2].trim();
				if (raw === "") {
					// 可能是空值或多行（折叠块）。文章里没有多行 frontmatter，直接置空
					data[k] = "";
					i++;
					continue;
				}
				if (raw === "true") { data[k] = true; i++; continue; }
				if (raw === "false") { data[k] = false; i++; continue; }
				if (raw === "null" || raw === "~") { data[k] = null; i++; continue; }
				if (/^".*"$/.test(raw)) { data[k] = raw.slice(1, -1).replace(/\\"/g, '"'); i++; continue; }
				if (/^'.*'$/.test(raw)) { data[k] = raw.slice(1, -1).replace(/\\'/g, "'"); i++; continue; }
				if (raw.indexOf("[") === 0) {
					// 行内数组 ["a", "b"]
					data[k] = parseInlineArray(raw);
					i++;
					continue;
				}
				if (/^- /.test(raw)) {
					// 块状列表
					var arr = [];
					while (i < lines.length) {
						var lm = /^-\s*(.*)$/.exec(lines[i]);
						if (!lm) break;
						arr.push(parseScalar(lm[1]));
						i++;
					}
					data[k] = arr;
					continue;
				}
				if (/^\d+$/.test(raw)) { data[k] = parseInt(raw, 10); i++; continue; }
				if (/^\d+\.\d+$/.test(raw)) { data[k] = parseFloat(raw); i++; continue; }
				data[k] = raw;
			}
			i++;
		}
		return { data: data, body: text.slice(m[0].length) };
	}

	function parseScalar(s) {
		s = s.trim();
		if (s === "true") return true;
		if (s === "false") return false;
		if (/^".*"$/.test(s)) return s.slice(1, -1);
		if (/^\d+$/.test(s)) return parseInt(s, 10);
		return s;
	}

	function parseInlineArray(raw) {
		// 兼容 ["a", "b"] / [a, b]
		var inner = raw.slice(1, raw.lastIndexOf("]") === -1 ? raw.length : raw.lastIndexOf("]"));
		var items = inner.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });
		return items.map(function (s) {
			if (/^".*"$/.test(s)) return s.slice(1, -1);
			if (/^'.*'$/.test(s)) return s.slice(1, -1);
			if (s === "true") return true;
			if (s === "false") return false;
			if (/^\d+$/.test(s)) return parseInt(s, 10);
			return s;
		});
	}

	/** 值序列化为 YAML 单行 */
	function yamlValue(v) {
		if (v === null || v === undefined) return "";
		if (typeof v === "boolean") return v ? "true" : "false";
		if (typeof v === "number") return String(v);
		if (Array.isArray(v)) {
			if (v.length === 0) return "[]";
			return "[" + v.map(function (x) { return JSON.stringify(x); }).join(", ") + "]";
		}
		if (typeof v === "string") {
			// 含特殊字符加引号
			if (/[:#\[\]{}\n]|^\s|\s$|^["'-]/.test(v)) return JSON.stringify(v);
			return v;
		}
		return String(v);
	}

	/** 序列化：data + body → 完整 MD 文本（保留 body 原样，body 前确保有换行） */
	function stringify(data, body) {
		var keys = Object.keys(data);
		var lines = ["---"];
		keys.forEach(function (k) {
			lines.push(k + ": " + yamlValue(data[k]));
		});
		lines.push("---");
		var out = lines.join("\n") + "\n";
		if (body && body.length) {
			out += (body.charAt(0) === "\n" ? "" : "\n") + body.replace(/^\n+/, "") + "\n";
		}
		return out;
	}

	/** 标题 → slug（参考站点 scripts/new-post.js 习惯：小写、空格转-、去符号；保留中文） */
	function slugify(title) {
		return title
			.trim()
			.toLowerCase()
			.replace(/[^\w\u4e00-\u9fa5]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}

	window.EditorMd = {
		parse: parse,
		stringify: stringify,
		slugify: slugify,
		yamlValue: yamlValue,
	};
})();
