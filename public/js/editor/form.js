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
			var opt = document.createElement("option");
			opt.value = o;
			opt.textContent = o === "" ? "（无）" : o;
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
				ctl = dt;
				break;
			}
			case "datetime": {
				var dtt = document.createElement("input");
				dtt.type = "text";
				dtt.className = "ef-input";
				dtt.value = target[field.key] || "";
				dtt.addEventListener("change", function () { target[field.key] = dtt.value; if (onChange) onChange(); });
				ctl = dtt;
				break;
			}
			case "select":
				ctl = selectControl(field, target);
				break;
			case "tags":
				ctl = tagsControl(field, target);
				break;
			case "image": {
				var imgWrap = el("div", "ef-image");
				var inp = document.createElement("input");
				inp.type = "text";
				inp.className = "ef-input";
				inp.value = target[field.key] || "";
				inp.placeholder = field.placeholder || "https:// 外链";
				inp.addEventListener("change", function () { target[field.key] = inp.value; if (onChange) onChange(); });
				var upBtn = el("button", "ef-btn ef-btn-sm", "上传到仓库");
				upBtn.addEventListener("click", function () {
					if (window.EditorUpload) window.EditorUpload.pickAndUpload(function (url) {
						inp.value = url;
						target[field.key] = url;
						if (onChange) onChange();
					});
				});
				imgWrap.appendChild(inp);
				imgWrap.appendChild(upBtn);
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
				ctl = inp2;
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
