/**
 * preview：轻量 Markdown → HTML 渲染器（纯前端，无依赖）
 * 用于文章编辑页正文实时预览。支持：标题、加粗、斜体、行内代码、
 * 代码块、链接、图片、有序/无序列表、引用、分隔线、段落。
 */
(function () {
	"use strict";

	function esc(s) {
		return String(s)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	// 行内元素
	function inline(s) {
		var codes = [];
		// 抽离行内代码，避免内部被其它规则破坏
		s = s.replace(/`([^`]+)`/g, function (_, c) {
			codes.push(c);
			return " CODE" + (codes.length - 1) + " ";
		});
		// 图片 ![alt](url)
		s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (_, alt, url) {
			return '<img src="' + esc(url) + '" alt="' + esc(alt) + '" style="max-width:100%">';
		});
		// 链接 [text](url)
		s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (_, t, url) {
			return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + t + "</a>";
		});
		// 加粗
		s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
		s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
		// 斜体
		s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
		s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
		// 还原行内代码
		s = s.replace(/ CODE(\d+) /g, function (_, i) {
			return "<code>" + esc(codes[+i]) + "</code>";
		});
		return s;
	}

	function render(md) {
		if (!md) return "";
		var lines = String(md).replace(/\r\n?/g, "\n").split("\n");
		var out = [];
		var i = 0;
		var listType = null; // "ul" | "ol"
		function closeList() {
			if (listType) { out.push("</" + listType + ">"); listType = null; }
		}
		while (i < lines.length) {
			var line = lines[i];

			// 代码块
			if (/^```/.test(line)) {
				closeList();
				var buf = [];
				i++;
				while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
				i++; // 跳过结束 ```
				out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>");
				continue;
			}
			// 分隔线
			if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
				closeList();
				out.push("<hr>");
				i++;
				continue;
			}
			// 标题
			var h = /^(#{1,6})\s+(.*)$/.exec(line);
			if (h) {
				closeList();
				var lvl = h[1].length;
				out.push("<h" + lvl + ">" + inline(esc(h[2].trim())) + "</h" + lvl + ">");
				i++;
				continue;
			}
			// 引用
			if (/^>\s?/.test(line)) {
				closeList();
				var qbuf = [];
				while (i < lines.length && /^>\s?/.test(lines[i])) {
					qbuf.push(lines[i].replace(/^>\s?/, ""));
					i++;
				}
				out.push("<blockquote>" + inline(esc(qbuf.join(" "))) + "</blockquote>");
				continue;
			}
			// 无序列表
			var ul = /^\s*[-*+]\s+(.*)$/.exec(line);
			if (ul) {
				if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
				out.push("<li>" + inline(esc(ul[1])) + "</li>");
				i++;
				continue;
			}
			// 有序列表
			var ol = /^\s*\d+\.\s+(.*)$/.exec(line);
			if (ol) {
				if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
				out.push("<li>" + inline(esc(ol[1])) + "</li>");
				i++;
				continue;
			}
			// 空行
			if (/^\s*$/.test(line)) {
				closeList();
				i++;
				continue;
			}
			// 段落（合并连续非空行）
			closeList();
			var pbuf = [line];
			i++;
			while (i < lines.length && !/^\s*$/.test(lines[i]) &&
				!/^```/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) &&
				!/^>\s?/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) &&
				!/^\s*\d+\.\s+/.test(lines[i]) && !/^(\s*[-*_]){3,}\s*$/.test(lines[i])) {
				pbuf.push(lines[i]);
				i++;
			}
			out.push("<p>" + inline(esc(pbuf.join(" "))) + "</p>");
		}
		closeList();
		return out.join("\n");
	}

	window.EditorPreview = { render: render };
})();
