/**
 * ts-io：TypeScript 数据文件读写核心
 * 定位目标变量（export const / const / export default 引用的 const）的数据字面量区间，
 * 提取为 JS 值；写回时只替换该区间，其余代码（import/interface/函数/注释）一字不动。
 */
(function () {
	"use strict";

	/** 括号匹配：src 从 openIdx（[ 或 {）开始，返回闭合位置（不含） */
	function matchBracket(src, openIdx) {
		var open = src[openIdx];
		var close = open === "[" ? "]" : "}";
		var depth = 1;
		var i = openIdx + 1;
		var n = src.length;
		var inStr = false, strCh = "", esc = false, inLine = false, inBlock = false;
		for (; i < n; i++) {
			var c = src[i];
			if (inStr) {
				if (esc) { esc = false; continue; }
				if (c === "\\") { esc = true; continue; }
				if (c === strCh) inStr = false;
				continue;
			}
			if (inLine) { if (c === "\n") inLine = false; continue; }
			if (inBlock) { if (c === "*" && src[i + 1] === "/") { inBlock = false; i++; } continue; }
			if (c === '"' || c === "'" || c === "`") { inStr = true; strCh = c; continue; }
			if (c === "/" && src[i + 1] === "/") { inLine = true; i++; continue; }
			if (c === "/" && src[i + 1] === "*") { inBlock = true; i++; continue; }
			if (c === open) { depth++; continue; }
			if (c === close) { depth--; if (depth === 0) return i + 1; }
		}
		return -1;
	}

	/**
	 * 定位数据字面量区间
	 * 支持声明形态：
	 *   export const xxxData = [...]     (varName=xxxData)
	 *   const xxxData = [...]            (varName=xxxData)
	 *   export default localAnimeList    (varName=localAnimeList，找 const localAnimeList =)
	 * 返回 { dataStart, dataEnd }（[ 或 { 的索引 与 闭合后的索引）；找不到返回 null
	 */
	function locate(source, varName) {
		var re = new RegExp("(?:export\\s+)?const\\s+" + varName + "\\s*(?::[^=]*)?=\\s*([\\[{])", "m");
		var m = re.exec(source);
		if (!m) return null;
		var openIdx = m.index + m[0].lastIndexOf(m[1]);
		var end = matchBracket(source, openIdx);
		if (end === -1) return null;
		return { dataStart: openIdx, dataEnd: end };
	}

	/** 提取数据为 JS 值（数据段是纯字面量，用 Function 求值安全） */
	function extract(source, varName) {
		var r = locate(source, varName);
		if (!r) return null;
		var text = source.slice(r.dataStart, r.dataEnd);
		try {
			// eslint-disable-next-line no-new-func
			return new Function("return (" + text + ");")();
		} catch (e) {
			return null;
		}
	}

	/** 合法标识符（含中文）不加引号 */
	function isIdentKey(k) {
		return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) || /^[\u4e00-\u9fa5][\u4e00-\u9fa5a-zA-Z0-9_$]*$/.test(k);
	}

	/** TS 风格字面量序列化（tab 缩进、双引号字符串、对象键不引号） */
	function serialize(v, indent) {
		indent = indent || 1;
		var pad = function (n) { return new Array(n + 1).join("\t"); };
		if (v === null) return "null";
		if (v === undefined) return "undefined";
		if (typeof v === "number") return String(v);
		if (typeof v === "boolean") return v ? "true" : "false";
		if (typeof v === "string") return JSON.stringify(v);
		if (Array.isArray(v)) {
			if (v.length === 0) return "[]";
			var inner = v.map(function (x) { return serialize(x, indent + 1); }).join(",\n" + pad(indent));
			return "[\n" + pad(indent) + inner + "\n" + pad(indent - 1) + "]";
		}
		if (typeof v === "object") {
			var keys = Object.keys(v);
			if (keys.length === 0) return "{}";
			var inner2 = keys.map(function (k) {
				var kk = isIdentKey(k) ? k : JSON.stringify(k);
				return kk + ": " + serialize(v[k], indent + 1);
			}).join(",\n" + pad(indent));
			return "{\n" + pad(indent) + inner2 + "\n" + pad(indent - 1) + "}";
		}
		return String(v);
	}

	/** 用新值替换数据区间，返回完整新源码（保留 BOM 及其他代码） */
	function replace(source, varName, newValue) {
		var r = locate(source, varName);
		if (!r) return null;
		var s = serialize(newValue);
		return source.slice(0, r.dataStart) + s + source.slice(r.dataEnd);
	}

	/** 检测源码是否带 BOM */
	function hasBom(text) {
		return text.charCodeAt(0) === 0xFEFF;
	}

	window.EditorTsIO = {
		locate: locate,
		extract: extract,
		serialize: serialize,
		replace: replace,
		hasBom: hasBom,
	};
})();
