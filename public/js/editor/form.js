/**
 * form：通用表单渲染器
 * 绑定模式：renderForm(schema, target, onChange) —— 直接操作 target 对象（target[field.key]）
 * 支持类型：string / text / number / boolean / date / datetime / select(可新建) / tags / image / pair / object / object-list / color / hidden
 */
(function () {
	"use strict";

	function el(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text !== undefined) e.textContent = text;
		return e;
	}

	function fieldWrap(field, control, note) {
		if (field.hidden) {
			var h = control;
			h.style.display = "none";
			return h;
		}
		var wrap = el("div", "ef-field");
		var label = el("label", "ef-label");
		label.textContent = field.label + (field.required ? " *" : "");
		wrap.appendChild(label);
		wrap.appendChild(control);
		if (field.placeholder) {
			var ph = el("div", "ef-placeholder", field.placeholder);
			wrap.appendChild(ph);
		}
		if (note) wrap.appendChild(note);
		return wrap;
	}

	function tagsControl(field, target) {
		var input = document.createElement("input");
		input.type = "text";
		input.className = "ef-input";
		input.placeholder = field.placeholder || "逗号分隔";
		var arr = target[field.key];
		if (Array.isArray(arr)) input.value = arr.join(", ");
		input.addEventListener("change", function () {
			var v = input.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
			target[field.key] = v;
		});
		return input;
	}

	function pairControl(field, target) {
		var wrap = el("div", "ef-pair");
		var lng = document.createElement("input");
		lng.type = "text";
		lng.className = "ef-input";
		lng.placeholder = "经度";
		var lat = document.createElement("input");
		lat.type = "text";
		lat.className = "ef-input";
		lat.placeholder = "纬度";
		var v = target[field.key];
		if (Array.isArray(v) && v.length >= 2) { lng.value = v[0]; lat.value = v[1]; }
		else { lng.value = v && typeof v === "object" ? v.lng : ""; lat.value = v && typeof v === "object" ? v.lat : ""; }
		function upd() {
			var a = parseFloat(lng.value), b = parseFloat(lat.value);
			if (!isNaN(a) && !isNaN(b)) target[field.key] = [a, b];
		}
		lng.addEventListener("change", upd);
		lat.addEventListener("change", upd);
		wrap.appendChild(lng);
		wrap.appendChild(lat);
		return wrap;
	}

	function objectControl(field, target, onChange) {
		var sub = target[field.key];
		if (!sub || typeof sub !== "object" || Array.isArray(sub)) { sub = {}; target[field.key] = sub; }
		var wrap = el("div", "ef-object");
		(field.fields || []).forEach(function (sf) {
			wrap.appendChild(renderField(sf, sub, onChange));
		});
		return wrap;
	}

	function objectListControl(field, target, onChange) {
		var list = target[field.key];
		if (!Array.isArray(list)) { list = []; target[field.key] = list; }
		var wrap = el("div", "ef-object-list");
		function renderItem(item, idx) {
			var row = el("div", "ef-ol-item");
			var head = el("div", "ef-ol-head");
			var title = el("span", "ef-ol-title", item[field.itemLabel || "name"] || ("条目 " + (idx + 1)));
			var del = el("button", "ef-btn ef-btn-danger ef-btn-sm", "删除");
			del.addEventListener("click", function () {
				list.splice(idx, 1);
				refresh();
				if (onChange) onChange();
			});
			head.appendChild(title);
			head.appendChild(del);
			var body = el("div", "ef-ol-body");
			(field.itemFields || []).forEach(function (sf) {
				body.appendChild(renderField(sf, item, onChange));
			});
			row.appendChild(head);
			row.appendChild(body);
			return row;
		}
		function refresh() {
			wrap.innerHTML = "";
			list.forEach(function (it, i) { wrap.appendChild(renderItem(it, i)); });
			var add = el("button", "ef-btn ef-btn-sm", "+ 添加");
			add.addEventListener("click", function () {
				var item = {};
				(field.itemFields || []).forEach(function (sf) {
					if (sf.type === "boolean") item[sf.key] = false;
					else if (sf.type === "tags") item[sf.key] = [];
					else if (sf.type === "object") item[sf.key] = {};
					else item[sf.key] = "";
				});
				list.push(item);
				refresh();
				if (onChange) onChange();
			});
			wrap.appendChild(add);
		}
		refresh();
		return wrap;
	}

	function selectControl(field, target) {
		var wrap = el("div", "ef-select-wrap");
		var sel = document.createElement("select");
		sel.className = "ef-input ef-select";
		var opts = field.options || [];
		opts.forEach(function (o) {
			var val = (typeof o === "object" && o !== null) ? o.value : o;
			var txt = (typeof o === "object" && o !== null) ? (o.label || o.value) : (o === "" ? "（无）" : o);
			var opt = document.createElement("option");
			opt.value = val;
			opt.textContent = txt;
			sel.appendChild(opt);
		});
		sel.value = target[field.key] !== undefined && target[field.key] !== null ? String(target[field.key]) : "";
		sel.addEventListener("change", function () {
			target[field.key] = sel.value;
			if (field.creatable) addBtn.style.display = sel.value === "__new__" ? "inline-block" : "none";
		});
		wrap.appendChild(sel);
		if (field.creatable) {
			var addBtn = el("button", "ef-btn ef-btn-sm", "+ 新建分类");
			addBtn.style.display = "none";
			addBtn.addEventListener("click", function () {
				var name = prompt("新分类名称：");
				if (!name) return;
				if (field.options.indexOf(name) === -1) field.options.push(name);
				var opt = document.createElement("option");
				opt.value = name;
				opt.textContent = name;
				sel.appendChild(opt);
				sel.value = name;
				target[field.key] = name;
			});
			wrap.appendChild(addBtn);
		}
		return wrap;
	}

	/** 从网址中提取根域名，用于 favicon.im 接口（去掉协议、路径、www. 等子域前缀） */
	function guessFaviconDomain(url) {
		if (!url) return "";
		var s = String(url).trim();
		s = s.replace(/^[a-zA-Z]+:\/\//, ""); // 去掉 http(s)://
		s = s.replace(/^\/+/, "");
		s = s.split("/")[0]; // 取主机部分
		s = s.split("?")[0].split("#")[0];
		if (!s) return "";
		if (s.indexOf(".") === -1) return s; // 已经是裸域名
		// 去掉常见的 www. 前缀
		s = s.replace(/^www\./, "");
		return s;
	}

	/** 渲染单个字段 */
	function renderField(field, target, onChange) {
		var type = field.type || "string";
		var ctl;
		switch (type) {
			case "text": {
				var ta = document.createElement("textarea");
				ta.className = "ef-input ef-textarea";
				ta.rows = field.rows || 4;
				ta.value = target[field.key] || "";
				ta.addEventListener("change", function () { target[field.key] = ta.value; if (onChange) onChange(); });
				ctl = ta;
				break;
			}
			case "number": {
				var num = document.createElement("input");
				num.type = "number";
				num.className = "ef-input";
				num.step = field.step || "1";
				num.value = target[field.key] !== undefined && target[field.key] !== null ? target[field.key] : "";
				num.addEventListener("change", function () {
					target[field.key] = num.value === "" ? undefined : (field.step === 0.1 ? parseFloat(num.value) : parseInt(num.value, 10));
					if (onChange) onChange();
				});
				ctl = num;
				break;
			}
			case "boolean": {
				var chk = document.createElement("input");
				chk.type = "checkbox";
				chk.className = "ef-checkbox";
				// 未设置时采用 schema 的 default（如文章 comment 默认允许评论），并回写 target，保证保存时显式落盘
				if ((target[field.key] === undefined || target[field.key] === null) && field.default !== undefined) {
					target[field.key] = !!field.default;
				}
				chk.checked = !!target[field.key];
				chk.addEventListener("change", function () { target[field.key] = chk.checked; if (onChange) onChange(); });
				ctl = chk;
				break;
			}
			case "date": {
				var dt = document.createElement("input");
				dt.type = "date";
				dt.className = "ef-input";
				var raw = target[field.key];
				if (raw) dt.value = String(raw).slice(0, 10);
				dt.addEventListener("change", function () { target[field.key] = dt.value; if (onChange) onChange(); });
				var dtRow = el("div", "ef-date-row");
				dtRow.appendChild(dt);
				var dtBtn = el("button", "ef-btn ef-btn-sm", "现在");
				dtBtn.type = "button";
				dtBtn.addEventListener("click", function () {
					var now = new Date();
					var v = now.getFullYear() + "-" +
						String(now.getMonth() + 1).padStart(2, "0") + "-" +
						String(now.getDate()).padStart(2, "0");
					dt.value = v;
					target[field.key] = v;
					if (onChange) onChange();
				});
				dtRow.appendChild(dtBtn);
				ctl = dtRow;
				break;
			}
			case "datetime": {
				var dtt = document.createElement("input");
				dtt.type = "text";
				dtt.className = "ef-input";
				dtt.value = target[field.key] || "";
				dtt.placeholder = field.placeholder || "2026-07-26T20:58:00+08:00";
				dtt.addEventListener("change", function () { target[field.key] = dtt.value; if (onChange) onChange(); });
				var dttRow = el("div", "ef-date-row");
				dttRow.appendChild(dtt);
				var dttBtn = el("button", "ef-btn ef-btn-sm", "现在");
				dttBtn.type = "button";
				dttBtn.addEventListener("click", function () {
					var now = new Date();
					var p = function (n) { return String(n).padStart(2, "0"); };
					var v = now.getFullYear() + "-" + p(now.getMonth() + 1) + "-" + p(now.getDate()) +
						"T" + p(now.getHours()) + ":" + p(now.getMinutes()) + ":" + p(now.getSeconds()) +
						(now.getTimezoneOffset() <= 0 ? "+" : "-") +
						p(Math.floor(Math.abs(now.getTimezoneOffset()) / 60)) + ":" + p(Math.abs(now.getTimezoneOffset()) % 60);
					dtt.value = v;
					target[field.key] = v;
					if (onChange) onChange();
				});
				dttRow.appendChild(dttBtn);
				ctl = dttRow;
				break;
			}
			case "select":
				ctl = selectControl(field, target);
				break;
			case "tags": {
				var tagsWrap = el("div", "ef-tags-wrap");
				var tagsInp = tagsControl(field, target);
				tagsWrap.appendChild(tagsInp);
				// 图片类 tags（images/photos/cover/images-array 等）：加「上传到图床」按钮
				var isImgTags = /(^|_)(images|photos|image|urls|pics)$/.test(field.key || "");
				if (isImgTags) {
					var tBtn = el("button", "ef-btn ef-btn-sm ef-btn-accent", "上传到图床");
					tBtn.title = "选图 → 上传图床 → 自动追加到该列表";
					tBtn.addEventListener("click", function () {
						if (!window.EditorImgBed) { alert("图床模块未加载"); return; }
						window.EditorImgBed.pickAndUpload(function (url) {
							var arr = Array.isArray(target[field.key]) ? target[field.key].slice() : [];
							arr.push(url);
							target[field.key] = arr;
							tagsInp.value = arr.join(", ");
							if (onChange) onChange();
						});
					});
					tagsWrap.appendChild(tBtn);
				}
				ctl = tagsWrap;
				break;
			}
			case "image": {
				var imgWrap = el("div", "ef-image");
				var inp = document.createElement("input");
				inp.type = "text";
				inp.className = "ef-input";
				inp.value = target[field.key] || "";
				inp.placeholder = field.placeholder || "https:// 外链";
				inp.addEventListener("change", function () { target[field.key] = inp.value; if (onChange) onChange(); });
				var upBtn = el("button", "ef-btn ef-btn-sm", "上传到仓库");
				upBtn.title = "压缩后上传到内容仓库 images/uploads";
				upBtn.addEventListener("click", function () {
					if (window.EditorUpload) window.EditorUpload.pickAndUpload(function (url) {
						inp.value = url;
						target[field.key] = url;
						if (onChange) onChange();
					});
				});
				// 新增：上传到你自己的图床（CF-ImgBed / Sanyue ImgHub）
				var imgbedBtn = el("button", "ef-btn ef-btn-sm ef-btn-accent", "上传到图床");
				imgbedBtn.title = "直接上传到你的图床（推荐）";
				imgbedBtn.addEventListener("click", function () {
					if (!window.EditorImgBed) { alert("图床模块未加载"); return; }
					window.EditorImgBed.pickAndUpload(function (url) {
						inp.value = url;
						target[field.key] = url;
						if (onChange) onChange();
					});
				});
				// 来自 siteurl 自动/手动生成图标后，同步刷新本输入框
				document.addEventListener("favicon-synced", function (e) {
					if (e.targetField === field.key) {
						inp.value = e.value;
						target[field.key] = e.value;
					}
				});
				imgWrap.appendChild(inp);
				imgWrap.appendChild(upBtn);
				imgWrap.appendChild(imgbedBtn);
				// 缩略图预览
				var prev = el("div", "ef-image-prev");
				function refreshPrev() {
					prev.innerHTML = "";
					if (inp.value) {
						var im = document.createElement("img");
						im.src = inp.value;
						im.onerror = function () { prev.innerHTML = ""; };
						prev.appendChild(im);
					}
				}
				inp.addEventListener("input", refreshPrev);
				refreshPrev();
				imgWrap.appendChild(prev);
				ctl = imgWrap;
				break;
			}
			case "pair":
				ctl = pairControl(field, target);
				break;
			case "object":
				ctl = objectControl(field, target, onChange);
				break;
			case "object-list":
				ctl = objectListControl(field, target, onChange);
				break;
			case "color": {
				var col = document.createElement("input");
				col.type = "color";
				col.className = "ef-input ef-color";
				if (target[field.key]) col.value = target[field.key];
				col.addEventListener("change", function () { target[field.key] = col.value; if (onChange) onChange(); });
				ctl = col;
				break;
			}
			default: {
				var inp2 = document.createElement("input");
				inp2.type = "text";
				inp2.className = "ef-input";
				inp2.value = target[field.key] || "";
				inp2.addEventListener("change", function () { target[field.key] = inp2.value; if (onChange) onChange(); });
				var ctlWrap = inp2;
				if (field.autoIconTarget) {
					var iconBtn = el("button", "ef-btn ef-btn-sm", "生成图标");
					iconBtn.type = "button";
					iconBtn.addEventListener("click", function () {
						var domain = guessFaviconDomain(inp2.value);
						if (!domain) { alert("请先填写有效的网站网址"); return; }
						target[field.autoIconTarget] = "https://a.favicon.im/" + domain;
						if (onChange) onChange();
						// 同步刷新目标 image 输入框显示
						var evt = new Event("favicon-synced");
						evt.targetField = field.autoIconTarget;
						evt.value = target[field.autoIconTarget];
						document.dispatchEvent(evt);
					});
					// 输入网址后，若目标图标字段为空则自动补全
					inp2.addEventListener("blur", function () {
						if (field.autoFillIcon && !target[field.autoIconTarget]) {
							var domain = guessFaviconDomain(inp2.value);
							if (domain) {
								target[field.autoIconTarget] = "https://a.favicon.im/" + domain;
								if (onChange) onChange();
								var evt2 = new Event("favicon-synced");
								evt2.targetField = field.autoIconTarget;
								evt2.value = target[field.autoIconTarget];
								document.dispatchEvent(evt2);
							}
						}
					});
					var iconRow = el("div", "ef-date-row");
					iconRow.appendChild(inp2);
					iconRow.appendChild(iconBtn);
					ctlWrap = iconRow;
				}
				ctl = ctlWrap;
				break;
			}
		}
		return fieldWrap(field, ctl);
	}

	/** 渲染一组字段 */
	function renderFields(fields, target, onChange) {
		var wrap = el("div", "ef-fields");
		(fields || []).forEach(function (f) {
			wrap.appendChild(renderField(f, target, onChange));
		});
		return wrap;
	}

	window.EditorForm = {
		renderField: renderField,
		renderFields: renderFields,
		el: el,
	};
})();
