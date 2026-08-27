/**
 * app：编辑器主应用
 * 入口：/admin/<page>-edit
 * 流程：解析 schema → 校验 PAT → 拉数据 → 列表+表单 → 保存（diff 预览）→ PUT
 */
(function () {
	"use strict";

	var SITE_BACK = "/"; // 返回站点默认
	var state = { schema: null, rawSource: "", rawSha: "", data: null, items: [], current: null, staged: {} };

	function $(s, root) { return (root || document).querySelector(s); }
	function $$(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }

	function esc(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	function getPat() { try { return sessionStorage.getItem("yuj_editor_pat") || ""; } catch (e) { return ""; } }
	function setPat(p) { try { sessionStorage.setItem("yuj_editor_pat", p); } catch (e) { } }
	function getFrom() { try { return sessionStorage.getItem("yuj_editor_from") || "/"; } catch (e) { return "/"; } }

	// 在 textarea 光标处插入文本（替换选区），并将光标移到插入内容之后
	function insertAtCursor(textarea, text) {
		if (!textarea) return;
		var start = textarea.selectionStart || 0;
		var end = textarea.selectionEnd || 0;
		var v = textarea.value;
		textarea.value = v.slice(0, start) + text + v.slice(end);
		var pos = start + text.length;
		textarea.selectionStart = textarea.selectionEnd = pos;
		textarea.focus();
	}

	function consumeHashPat() {
		var h = location.hash;
		if (!h) return;
		var m = h.match(/^#pat=([^&]+)/);
		if (!m) return;
		try {
			setPat(decodeURIComponent(m[1]));
			history.replaceState(null, "", location.pathname + location.search);
		} catch (e) { }
	}
	consumeHashPat();

	function goBack() {
		window.location.href = getFrom();
	}

	// ---------- 暂存 / 统一推送 ----------

	function stagePut(path, content, message) {
		state.staged[path] = { path: path, content: content, message: message, del: false };
		updatePushBtn();
		if (window.EditorPages) window.EditorPages();
		toast("已暂存：" + path.split("/").pop() + "（待推送）");
	}
	function stageDelete(path, message) {
		state.staged[path] = { path: path, content: null, message: message, del: true };
		updatePushBtn();
		if (window.EditorPages) window.EditorPages();
		toast("已暂存删除：" + path.split("/").pop() + "（待推送）");
	}
	function updatePushBtn() {
		var n = Object.keys(state.staged).length;
		var btn = $("#ed-push");
		if (!btn) return;
		var nEl = $("#ed-push-n");
		if (nEl) nEl.textContent = n;
		btn.style.display = n > 0 ? "" : "none";
	}
	function toast(msg) {
		var t = document.createElement("div");
		t.textContent = msg;
		t.style.cssText = "position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:rgba(20,20,30,.92);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,.3)";
		document.body.appendChild(t);
		setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1800);
	}
	function pushAll() {
		var paths = Object.keys(state.staged);
		if (paths.length === 0) return;
		if (!confirm("确认统一推送 " + paths.length + " 项变更？（将合并为 1 次提交并触发部署）")) return;
		var s = state.schema;
		var changes = paths.map(function (p) {
			var e = state.staged[p];
			return e.del ? { path: p, delete: true } : { path: p, content: e.content };
		});
		var msg = "chore(editor): 批量更新 " + paths.length + " 项";
		// 记录本次涉及的所有 repo/branch，推送成功后局部刷新对应数据（不整页 reload）
		var touched = {};
		paths.forEach(function (p) {
			var k = s.owner + "/" + s.repo + "@" + s.branch;
			touched[k] = true;
		});
		window.EditorGit.commitTree(s.owner, s.repo, s.branch, changes, msg)
			.then(function (r) {
				if (!r || !r.commitSha) throw new Error("提交返回为空，可能未生效");
				toast("✅ 推送成功（" + paths.length + " 项，1 次提交）部署中…", 2600);
				// 仅清空本次已推送的暂存项，其余页面暂存保留
				paths.forEach(function (p) { delete state.staged[p]; });
				renderPages();
				// 局部刷新当前页面数据，避免整页 reload 的等待
				loadData().then(function () { renderList(); renderForm(); });
			})
			.catch(function (e) { alert("推送失败：" + e.message); });
	}

	// ---------- 数据加载 ----------

	function loadData() {
		var s = state.schema;
		if (s.format === "album") return loadAlbums();
		if (s.format === "md-posts") return loadPosts();
		return window.EditorGit.getFile(s.owner, s.repo, s.path, s.branch).then(function (f) {
			state.rawSource = f ? f.content : "";
			state.rawSha = f ? f.sha : "";
			if (!f) throw new Error("文件不存在：" + s.path + "（可尝试新建）");
			if (s.format === "ts-array" || s.format === "ts-object" || s.format === "ts-map") {
				var v = window.EditorTsIO.extract(state.rawSource, s.varName);
				if (v === null) throw new Error("无法解析 " + s.path + " 的数据段（" + s.varName + "）");
				state.data = v;
				if (s.format === "ts-map") {
					state.items = Object.keys(v).map(function (k) { return { key: k, items: v[k] }; });
				} else if (Array.isArray(v)) {
					state.items = v;
					// 动态等按 date 倒序：最新在最上面（列表显示与文件存储一致）
					if (s.format === "ts-array" && v.length && "date" in v[0]) {
						state.items.sort(function (a, b) {
							return String(b.date || "").localeCompare(String(a.date || ""));
						});
					}
				} else {
					// ts-object（如公告）：作为单项列表
					state.items = [v];
				}
			} else if (s.format === "md-file") {
				var p = window.EditorMd.parse(state.rawSource);
				state.data = p.data;
				state.body = p.body;
			}
		});
	}

	function loadPosts() {
		var s = state.schema;
		return window.EditorGit.listDir(s.owner, s.repo, s.path, s.branch).then(function (files) {
			return files.filter(function (f) { return /\.md$/.test(f.name); }).map(function (f) { return f; });
		}).then(function (list) {
			state.items = list;
		});
	}

	function loadAlbums() {
		var s = state.schema;
		return window.EditorGit.listDir(s.owner, s.repo, s.path, s.branch).then(function (dirs) {
			state.items = dirs.filter(function (d) { return d.type === "dir"; });
		});
	}

	// ---------- 渲染 ----------

	function renderHeader() {
		var s = state.schema;
		var header = $(".ed-header");
		header.innerHTML =
			"<div class='ed-header-left'>" +
			"<button class='ef-btn' id='ed-back'>← 返回站点</button>" +
			"<h1 class='ed-title'>" + esc(s.label) + "编辑器</h1>" +
			"<span class='ed-sub'>" + esc(s.repo + "/" + s.path) + "</span>" +
			"</div>" +
			"<div class='ed-header-right'>" +
			"<span class='ed-user' id='ed-user'></span>" +
			"<button class='ef-btn ef-btn-primary' id='ed-push' style='display:none'>统一推送 (<span id='ed-push-n'>0</span>)</button>" +
			"<button class='ef-btn' id='ed-logout'>退出编辑</button>" +
			"</div>";
		$("#ed-back").addEventListener("click", goBack);
		var pushBtn = $("#ed-push");
		if (pushBtn) pushBtn.addEventListener("click", pushAll);
		updatePushBtn();
		$("#ed-logout").addEventListener("click", function () {
			sessionStorage.removeItem("yuj_editor_pat");
			goBack();
		});
		try {
			fetch("https://api.github.com/user", {
				headers: { "Authorization": "Bearer " + getPat(), "Accept": "application/vnd.github+json", "User-Agent": "yujing-blog-editor" },
			}).then(function (r) { return r.json(); }).then(function (u) {
				if (u && u.login) $("#ed-user").textContent = "👤 " + u.login;
			}).catch(function () { });
		} catch (e) { /* 编辑器不依赖用户信息，获取失败不影响使用 */ }
	}

	// ---------- 页面切换侧栏（SPA 内切换，保留跨页 staged） ----------
	function renderPages() {
		var root = $("#ed-pages");
		if (!root) return;
		root.innerHTML = "";
		var head = el("div", "ed-pages-head", "编辑页面");
		root.appendChild(head);
		var keys = Object.keys(window.EditorSchemas || {});
		keys.forEach(function (k) {
			var s = window.EditorSchemas[k];
			var item = el("button", "ed-page-item" + (k === state.schema.key ? " active" : ""));
			item.textContent = s.label || k;
			// 统计该页面在 staged 中的待推送项
			var pending = 0;
			Object.keys(state.staged).forEach(function (p) {
				if (p.indexOf(s.path) === 0 || (s.format === "album" && p.indexOf("images/" + s.path.replace(/^.*\//, "")) >= 0)) pending++;
			});
			if (pending > 0) {
				var badge = el("span", "ed-page-badge", String(pending));
				item.appendChild(badge);
			}
			item.addEventListener("click", function () { switchPage(k); });
			root.appendChild(item);
		});
		var tip = el("div", "ed-pages-tip", "切换页面编辑，所有改动在「推送」时合并为一次提交");
		root.appendChild(tip);
	}

	// 切换页面：重新加载目标页面数据，但保留跨页 staged（已暂存改动不丢）
	function switchPage(key) {
		var s = window.EditorSchemas[key];
		if (!s) return;
		state.schema = s;
		state.items = [];
		state.current = null;
		state.search = "";
		state.unsaved = false;
		renderPages();
		loadData().then(function () { renderList(); renderForm(); });
	}

	function renderList() {
		var s = state.schema;
		var list = $(".ed-list");
		list.innerHTML = "";
		var addBtn = el("button", "ef-btn ef-btn-primary ef-btn-block", "+ 新增");
		if (s.format === "album") {
			addBtn.addEventListener("click", function () { newAlbum(); });
		} else if (s.format === "md-posts") {
			addBtn.addEventListener("click", function () { newPost(); });
			var uploadBtn = el("button", "ef-btn ef-btn-block", "⬆ 上传 .md 文档");
			uploadBtn.addEventListener("click", function () { uploadMdFile(); });
			list.appendChild(uploadBtn);
		} else if (s.format === "ts-map") {
			addBtn.textContent = "+ 新增分类";
			addBtn.addEventListener("click", function () {
				var name = prompt("分类名称（如 手机 / 电脑 / 相机）：");
				if (!name) return;
				name = name.trim();
				if (!name) return;
				if (state.items.some(function (c) { return c.key === name; })) { alert("分类已存在"); return; }
				state.items.push({ key: name, items: [] });
				renderList();
			});
		} else {
			addBtn.addEventListener("click", function () { addItem(); });
		}
		list.appendChild(addBtn);
		state.items.forEach(function (it, i) {
			var row = el("div", "ed-list-item");
			row.textContent = itemLabel(s, it, i);
			row.addEventListener("click", function () { selectItem(i); });
			list.appendChild(row);
		});
	}

	function itemLabel(s, it, i) {
		if (typeof s.itemLabel === "function") return s.itemLabel(it);
		var v = it[s.itemLabel];
		if (v !== undefined && v !== null && v !== "") return String(v);
		if (s.format === "md-posts") return it.name;
		if (s.format === "album") return it.name;
		return "#" + (i + 1);
	}

	function selectItem(i) {
		var s = state.schema;
		if (s.format === "md-posts") {
			var f = state.items[i];
			state.current = { file: f, data: null, body: "" };
			window.EditorGit.getFile(s.owner, s.repo, f.path, s.branch).then(function (r) {
				if (!r) throw new Error("读取失败");
				var p = window.EditorMd.parse(r.content);
				state.current.sha = r.sha;
				state.current.data = p.data;
				state.current.body = p.body;
				state.current.raw = r.content;
				renderForm();
			}).catch(function (e) { alert(e.message); });
		} else if (s.format === "album") {
			var a = state.items[i];
			state.current = { dir: a, info: null, images: [], sha: "" };
			renderAlbumForm();
		} else if (s.format === "ts-map") {
			state.current = state.items[i];
			renderMapForm(state.current);
		} else {
			state.current = state.items[i];
			renderForm();
		}
	}

	// ts-map（设备：分类 → 设备列表）特殊表单
	function renderMapForm(cat) {
		var s = state.schema;
		var panel = $(".ed-panel");
		panel.innerHTML = "";
		var h = el("div", "ed-panel-head");
		h.appendChild(el("h2", "ed-panel-title", "分类：" + esc(cat.key)));
		panel.appendChild(h);

		var nameWrap = el("div", "ef-field");
		var nl = el("label", "ef-label", "分类名称");
		var nameInput = document.createElement("input");
		nameInput.type = "text";
		nameInput.className = "ef-input";
		nameInput.value = cat.key;
		nameInput.addEventListener("change", function () {
			var newKey = nameInput.value.trim();
			if (!newKey || newKey === cat.key) return;
			var idx = state.items.indexOf(cat);
			var map = {};
			state.items.forEach(function (c) { map[c.key] = c.items; });
			var arr = map[cat.key];
			delete map[cat.key];
			map[newKey] = arr;
			cat.key = newKey;
			state.items[idx].key = newKey;
			nameInput.value = newKey;
		});
		nameWrap.appendChild(nl);
		nameWrap.appendChild(nameInput);
		panel.appendChild(nameWrap);

		var listWrap = el("div", "ef-object-list");
		function renderDevices() {
			listWrap.innerHTML = "";
			cat.items.forEach(function (dev, di) {
				var row = el("div", "ef-ol-item");
				var head = el("div", "ef-ol-head");
				var t = el("span", "ef-ol-title", dev.name || ("设备 " + (di + 1)));
				var del = el("button", "ef-btn ef-btn-danger ef-btn-sm", "删除");
				del.addEventListener("click", function () {
					if (!confirm("删除设备「" + (dev.name || "") + "」？")) return;
					cat.items.splice(di, 1);
					renderDevices();
				});
				head.appendChild(t);
				head.appendChild(del);
				var body = el("div", "ef-ol-body");
				s.fields.forEach(function (f) {
					body.appendChild(window.EditorForm.renderField(f, dev, function () { }));
				});
				row.appendChild(head);
				row.appendChild(body);
				listWrap.appendChild(row);
			});
			var add = el("button", "ef-btn ef-btn-sm", "+ 添加设备");
			add.addEventListener("click", function () {
				var dev = {};
				s.fields.forEach(function (f) {
					if (f.type === "boolean") dev[f.key] = false;
					else if (f.type === "tags") dev[f.key] = [];
					else dev[f.key] = "";
				});
				cat.items.push(dev);
				renderDevices();
			});
			listWrap.appendChild(add);
		}
		renderDevices();
		panel.appendChild(listWrap);

		var acts = el("div", "ed-actions");
		var save = el("button", "ef-btn ef-btn-primary", "💾 保存");
		save.addEventListener("click", function () { saveItem(); });
		var delCat = el("button", "ef-btn ef-btn-danger", "🗑 删除分类");
		delCat.addEventListener("click", function () {
			if (!confirm("删除分类「" + cat.key + "」及其全部设备？删除将在「统一推送」时生效")) return;
			var idx = state.items.indexOf(cat);
			if (idx > -1) state.items.splice(idx, 1);
			var newSource = null;
			try {
				var map = {};
				state.items.forEach(function (c) { map[c.key] = c.items; });
				newSource = window.EditorTsIO.replace(state.rawSource, s.varName, map);
			} catch (e) { alert(e.message); return; }
			state.rawSource = newSource;
			stagePut(s.path, newSource, "chore(editor): delete category");
			renderList();
			$(".ed-panel").innerHTML = "";
		});
		acts.appendChild(save);
		acts.appendChild(delCat);
		panel.appendChild(acts);
	}

	function renderForm() {
		var s = state.schema;
		var panel = $(".ed-panel");
		var editing = state.current;
		panel.innerHTML = "";
		var h = el("div", "ed-panel-head");
		h.appendChild(el("h2", "ed-panel-title", "编辑" + s.label));
		panel.appendChild(h);
		var fields = el("div", "ef-fields");
		if (s.format === "md-posts") {
			fields.appendChild(window.EditorForm.renderFields(s.fields, editing.data, function () { }));
		} else {
			fields.appendChild(window.EditorForm.renderFields(s.fields, editing, function () { }));
		}
		panel.appendChild(fields);
		// 正文区（文章/关于）：Markdown 编辑 + 实时预览
		if (s.format === "md-posts" || s.format === "md-file") {
			var bodyWrap = el("div", "ef-field");
			var bl = el("label", "ef-label", "正文（Markdown，右侧实时预览）");
			bodyWrap.appendChild(bl);
			// 工具栏：上传图片到图床
			var toolbar = el("div", "ef-toolbar");
			var imgBtn = el("button", "ef-btn ef-btn-sm", "🖼 上传图片到图床");
			imgBtn.addEventListener("click", function () {
				if (!window.EditorImgBed) { alert("图床模块未加载"); return; }
				window.EditorImgBed.pickAndUpload(function (imgUrl) {
					insertAtCursor(ta, "![](" + imgUrl + ")\n");
					renderPreview();
				});
			});
			toolbar.appendChild(imgBtn);
			bodyWrap.appendChild(toolbar);
			var bodyCols = el("div", "ef-body-cols");
			var ta = document.createElement("textarea");
			ta.className = "ef-input ef-textarea ef-body";
			ta.id = "ef-body";
			ta.rows = 18;
			ta.value = editing.body || "";
			var preview = el("div", "ef-body-preview markdown-body");
			preview.id = "ef-body-preview";
			function renderPreview() {
				editing.body = ta.value;
				if (window.EditorPreview) preview.innerHTML = window.EditorPreview.render(ta.value);
			}
			ta.addEventListener("input", renderPreview);
			ta.addEventListener("change", function () { editing.body = ta.value; });
			bodyCols.appendChild(ta);
			bodyCols.appendChild(preview);
			bodyWrap.appendChild(bodyCols);
			panel.appendChild(bodyWrap);
			// 初次渲染预览
			if (window.EditorPreview) preview.innerHTML = window.EditorPreview.render(ta.value);
		}
		// 公告 content 特殊编辑
		if (s.format === "ts-object" && s.contentField) {
			panel.appendChild(renderAnnouncementContent(editing));
		}
		var actions = el("div", "ed-actions");
		var saveBtn = el("button", "ef-btn ef-btn-primary", "💾 保存");
		saveBtn.addEventListener("click", function () { saveItem(); });
		var delBtn = el("button", "ef-btn ef-btn-danger", "🗑 删除");
		delBtn.addEventListener("click", function () { deleteItem(); });
		actions.appendChild(saveBtn);
		if (s.format !== "md-file") actions.appendChild(delBtn);
		panel.appendChild(actions);
	}

	function renderAnnouncementContent(obj) {
		var list = obj.content;
		if (!Array.isArray(list)) {
			if (typeof list === "string") list = [list];
			else if (list && typeof list === "object") list = [list];
			else list = [];
		}
		var wrap = el("div", "ef-field");
		var l = el("label", "ef-label", "公告内容（每条可为纯文本或 文本+链接）");
		wrap.appendChild(l);
		var listWrap = el("div", "ef-object-list");
		function renderOne(item, idx) {
			var row = el("div", "ef-ol-item");
			var head = el("div", "ef-ol-head");
			var kindSel = document.createElement("select");
			kindSel.className = "ef-input ef-select";
			var o1 = document.createElement("option"); o1.value = "str"; o1.textContent = "纯文本"; kindSel.appendChild(o1);
			var o2 = document.createElement("option"); o2.value = "obj"; o2.textContent = "文本+链接"; kindSel.appendChild(o2);
			kindSel.value = typeof item === "object" ? "obj" : "str";
			var del = el("button", "ef-btn ef-btn-danger ef-btn-sm", "删除");
			del.addEventListener("click", function () { list.splice(idx, 1); refresh(); });
			head.appendChild(kindSel);
			head.appendChild(del);
			var body = el("div", "ef-ol-body");
			function renderBody() {
				body.innerHTML = "";
				if (kindSel.value === "str") {
					var ta = document.createElement("textarea");
					ta.className = "ef-input ef-textarea";
					ta.rows = 2;
					ta.value = typeof item === "string" ? item : (item.content || "");
					ta.addEventListener("change", function () { list[idx] = ta.value; });
					body.appendChild(ta);
				} else {
					var sub = typeof item === "object" ? item : { content: item };
					var ta2 = document.createElement("textarea");
					ta2.className = "ef-input ef-textarea";
					ta2.rows = 2;
					ta2.placeholder = "文本内容";
					ta2.value = sub.content || "";
					ta2.addEventListener("change", function () { sub.content = ta2.value; list[idx] = sub; });
					body.appendChild(ta2);
					var linkWrap = el("div", "ef-object");
					var lf = [
						{ key: "enable", label: "启用链接", type: "boolean" },
						{ key: "text", label: "链接文字", type: "string" },
						{ key: "url", label: "链接地址", type: "string" },
						{ key: "external", label: "外部链接", type: "boolean" },
					];
					if (!sub.link) sub.link = {};
					lf.forEach(function (sf) {
						body.appendChild(window.EditorForm.renderField(sf, sub.link, function () { list[idx] = sub; }));
					});
				}
			}
			kindSel.addEventListener("change", function () {
				if (kindSel.value === "str" && typeof item === "object") { list[idx] = item.content || ""; item = list[idx]; }
				if (kindSel.value === "obj" && typeof item === "string") { list[idx] = { content: item, link: {} }; item = list[idx]; }
				renderBody();
			});
			renderBody();
			row.appendChild(head);
			row.appendChild(body);
			return row;
		}
		function refresh() {
			listWrap.innerHTML = "";
			list.forEach(function (it, i) { listWrap.appendChild(renderOne(it, i)); });
			var add = el("button", "ef-btn ef-btn-sm", "+ 添加公告");
			add.addEventListener("click", function () {
				list.push({ content: "", link: { enable: false, text: "", url: "", external: false } });
				refresh();
			});
			listWrap.appendChild(add);
		}
		refresh();
		wrap.appendChild(listWrap);
		obj.content = list;
		return wrap;
	}

	// ---------- 相册 ----------

	function newAlbum() {
		var name = prompt("相册文件夹名（将作为相册 ID 与 URL）：");
		if (!name) return;
		name = name.trim();
		if (!name) return;
		var s = state.schema;
		var info = { title: name, description: "", date: new Date().toISOString().slice(0, 10), location: "", tags: [] };
		var path = s.path + "/" + name + "/info.json";
		stagePut(path, JSON.stringify(info, null, 2), "chore: create album " + name);
		state.items.push({ name: name, type: "dir" });
		renderList();
	}

	function renderAlbumForm() {
		var s = state.schema;
		var panel = $(".ed-panel");
		var cur = state.current;
		panel.innerHTML = "";
		var h = el("div", "ed-panel-head");
		h.appendChild(el("h2", "ed-panel-title", "相册：" + esc(cur.dir.name)));
		panel.appendChild(h);
		window.EditorGit.getFile(s.owner, s.repo, s.path + "/" + cur.dir.name + "/info.json", s.branch).then(function (f) {
			var info = {};
			if (f && f.content) { try { info = JSON.parse(f.content); } catch (e) { } cur.sha = f.sha; }
			cur.info = info;
			// 基础字段（title/description/date/location/tags/password 等）
			panel.appendChild(window.EditorForm.renderFields(s.fields, info, function () { }));
			// 模式选择：本地 / 外链
			var modeField = el("div", "ef-field");
			modeField.appendChild(el("label", "ef-label", "图片模式"));
			var modeWrap = el("div", "ef-select-wrap");
			var modeSel = el("select", "ef-input ef-select");
			modeSel.id = "al-mode";
			var optLocal = el("option", null, "本地（上传图片到仓库）"); optLocal.value = "local";
			var optExt = el("option", null, "外链（填写图片 URL，不占仓库空间）"); optExt.value = "external";
			modeSel.appendChild(optLocal); modeSel.appendChild(optExt);
			modeSel.value = info.mode === "external" ? "external" : "local";
			modeWrap.appendChild(modeSel);
			modeField.appendChild(modeWrap);
			panel.appendChild(modeField);
			// 外链模式 UI
			var extBox = el("div", "al-external");
			extBox.id = "al-external";
			var coverField = el("div", "ef-field");
			coverField.appendChild(el("label", "ef-label", "外链封面 URL"));
			var coverInput = el("input", "ef-input");
			coverInput.id = "al-cover-url";
			coverInput.placeholder = "https://... 封面图片直链";
			coverInput.value = info.mode === "external" ? (info.cover || "") : "";
			coverField.appendChild(coverInput);
			extBox.appendChild(coverField);
			var photosField = el("div", "ef-field");
			photosField.appendChild(el("label", "ef-label", "外链图片列表"));
			var photosBox = el("div", "al-photos");
			photosBox.id = "al-photos";
			photosField.appendChild(photosBox);
			var addPhoto = el("button", "ef-btn ef-btn-sm", "➕ 添加外链图片");
			addPhoto.addEventListener("click", function () { addExternalPhotoRow(photosBox, {}); });
			photosField.appendChild(addPhoto);
			extBox.appendChild(photosField);
			panel.appendChild(extBox);
			// 本地模式 UI
			var localBox = el("div", "al-local");
			localBox.id = "al-local";
			var acts = el("div", "ed-actions");
			var upCover = el("button", "ef-btn", "🖼 上传封面");
			upCover.addEventListener("click", function () {
				var target = s.path + "/" + cur.dir.name + "/cover.webp";
				window.EditorUpload.pickForPath(target, function () { alert("封面已上传（cover.webp 优先于 cover.jpg）"); refreshImages(); });
			});
			var addImg = el("button", "ef-btn", "➕ 上传图片");
			addImg.addEventListener("click", function () {
				var target = s.path + "/" + cur.dir.name + "/" + (prompt("图片文件名（不含下划线，用 - 代替）：") || "");
				if (!target.endsWith("/")) return;
				window.EditorUpload.pickForPath(target, function () { alert("已上传"); refreshImages(); });
			});
			acts.appendChild(upCover); acts.appendChild(addImg);
			localBox.appendChild(acts);
			var imgBox = el("div", "ed-images");
			imgBox.id = "al-images-local";
			localBox.appendChild(imgBox);
			var delAll = el("button", "ef-btn ef-btn-danger", "🗑 删除整个相册");
			delAll.addEventListener("click", function () { deleteAlbum(cur); });
			localBox.appendChild(delAll);
			panel.appendChild(localBox);
			// 模式切换
			function toggleMode() {
				var ext = modeSel.value === "external";
				extBox.style.display = ext ? "" : "none";
				localBox.style.display = ext ? "none" : "";
			}
			modeSel.addEventListener("change", toggleMode);
			toggleMode();
			// 初始外链图片行
			var initialPhotos = info.mode === "external" ? (info.photos || []) : [];
			initialPhotos.forEach(function (p) { addExternalPhotoRow(photosBox, p); });
			if (initialPhotos.length === 0) addExternalPhotoRow(photosBox, {});
			// 暂存按钮
			var saveActs = el("div", "ed-actions");
			var save = el("button", "ef-btn ef-btn-primary", "💾 暂存配置");
			save.addEventListener("click", function () {
				var finalInfo = JSON.parse(JSON.stringify(info));
				var mode = modeSel.value;
				if (mode === "external") {
					finalInfo.mode = "external";
					finalInfo.cover = coverInput.value.trim();
					var photos = [];
					photosBox.querySelectorAll(".al-photo-row").forEach(function (row) {
						var src = row.querySelector(".al-photo-src").value.trim();
						var alt = row.querySelector(".al-photo-alt").value.trim();
						if (src) photos.push({ src: src, alt: alt || "" });
					});
					finalInfo.photos = photos;
				} else {
					delete finalInfo.mode;
					delete finalInfo.photos;
				}
				var content = JSON.stringify(finalInfo, null, 2);
				var path = s.path + "/" + cur.dir.name + "/info.json";
				stagePut(path, content, "chore: update album " + cur.dir.name);
			});
			saveActs.appendChild(save);
			panel.appendChild(saveActs);
			refreshImages();
		});
	}

	function addExternalPhotoRow(box, p) {
		var row = el("div", "al-photo-row ef-field");
		var srcI = el("input", "ef-input al-photo-src");
		srcI.placeholder = "图片直链 URL";
		srcI.value = p.src || "";
		var altI = el("input", "ef-input al-photo-alt");
		altI.placeholder = "图片描述（可选）";
		altI.value = p.alt || "";
		var del = el("button", "ef-btn ef-btn-danger ef-btn-sm", "删除");
		del.addEventListener("click", function () { row.parentNode.removeChild(row); });
		row.appendChild(srcI); row.appendChild(altI); row.appendChild(del);
		box.appendChild(row);
	}

	function refreshImages() {
		var s = state.schema;
		var cur = state.current;
		var imgBox = $("#al-images-local");
		if (!imgBox) {
			imgBox = el("div", "ed-images");
			imgBox.id = "al-images-local";
			imgBox.appendChild(el("h3", "ed-panel-title", "相册图片"));
			var localBox = $("#al-local");
			if (localBox) localBox.appendChild(imgBox); else $(".ed-panel").appendChild(imgBox);
		}
		imgBox.innerHTML = "";
		window.EditorGit.listDir(s.owner, s.repo, s.path + "/" + cur.dir.name, s.branch).then(function (files) {
			files.filter(function (f) { return /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name); }).forEach(function (f) {
				var item = el("div", "ed-img-item");
				var img = document.createElement("img");
				img.src = "https://raw.githubusercontent.com/" + s.owner + "/" + s.repo + "/" + s.branch + "/" + encodeURI(f.path).replace(/%2F/g, "/");
				img.alt = f.name;
				var name = el("div", "ed-img-name", f.name);
				var del = el("button", "ef-btn ef-btn-danger ef-btn-sm", "删除");
				del.addEventListener("click", function () {
					if (!confirm("删除 " + f.name + " ？")) return;
					window.EditorGit.deleteFile(s.owner, s.repo, f.path, "chore: delete " + f.name, s.branch).then(function () { refreshImages(); });
				});
				item.appendChild(img);
				item.appendChild(name);
				item.appendChild(del);
				imgBox.appendChild(item);
			});
		});
	}

	function deleteAlbum(cur) {
		var s = state.schema;
		if (!confirm("确认删除相册 " + cur.dir.name + " 及其全部文件？此操作不可撤销！")) return;
		window.EditorGit.listDir(s.owner, s.repo, s.path + "/" + cur.dir.name, s.branch).then(function (files) {
			var changes = files.map(function (f) { return { path: f.path, delete: true }; });
			if (changes.length === 0) return Promise.resolve();
			return window.EditorGit.commitTree(s.owner, s.repo, s.branch, changes, "chore: delete album " + cur.dir.name);
		}).then(function () { return loadAlbums(); })
			.then(function () { renderList(); $(".ed-panel").innerHTML = ""; })
			.catch(function (e) { alert(e.message); });
	}

	// ---------- 文章 ----------

	function newPost() {
		var title = prompt("文章标题：");
		if (!title) return;
		var slug = window.EditorMd.slugify(title);
		var today = new Date().toISOString().slice(0, 10);
		var s = state.schema;
		var filename = today + "-" + slug + ".md";
		var content = "---\ntitle: \"" + title.replace(/"/g, '\\"') + "\"\npublished: " + today + "\ndraft: true\ntags: []\ncategory: \"\"\ncomment: true\n---\n\n# " + title + "\n";
		var path = s.path + "/" + filename;
		stagePut(path, content, "chore: new post " + filename);
		state.items.push({ name: filename, path: path, type: "file" });
		renderList();
	}

	// 上传 .md 文档：读取本地文件 → 解析 frontmatter/body → 新建文章并进入编辑器
	function uploadMdFile() {
		var s = state.schema;
		if (!s || s.format !== "md-posts") return;
		var input = document.createElement("input");
		input.type = "file";
		input.accept = ".md,.markdown,text/markdown,text/plain";
		input.addEventListener("change", function () {
			var file = input.files && input.files[0];
			if (!file) return;
			var reader = new FileReader();
			reader.onload = function () {
				var raw = String(reader.result || "");
				var parsed = window.EditorMd.parseFrontmatter(raw);
				var data = parsed.data || {};
				var body = parsed.body || "";
				// 文件名：优先用标题 slug，否则用上传文件名
				var title = (typeof data.title === "string") ? data.title : file.name.replace(/\.(md|markdown)$/i, "");
				var slug = window.EditorMd.slugify(title) || file.name.replace(/\.(md|markdown)$/i, "");
				var today = new Date().toISOString().slice(0, 10);
				var filename = today + "-" + slug + ".md";
				// 重建 frontmatter（仅保留文章 schema 关注的字段，缺省补齐）
				var fm = {
					title: title,
					published: data.published || today,
					updated: data.updated || today,
					draft: (typeof data.draft === "boolean") ? data.draft : true,
					tags: Array.isArray(data.tags) ? data.tags : [],
					category: typeof data.category === "string" ? data.category : "",
					comment: (typeof data.comment === "boolean") ? data.comment : true
				};
				var fmStr = "---\n" + Object.keys(fm).map(function (k) {
					var v = fm[k];
					if (Array.isArray(v)) return k + ": [" + v.map(function (t) { return '"' + String(t).replace(/"/g, '\\"') + '"'; }).join(", ") + "]";
					if (typeof v === "boolean") return k + ": " + v;
					return k + ': "' + String(v).replace(/"/g, '\\"') + '"';
				}).join("\n") + "\n---\n";
				var content = fmStr + (body ? body.replace(/^\n+/, "\n") : "\n");
				var path = s.path + "/" + filename;
				var existing = state.items.find(function (it) { return it.name === filename; });
				if (existing) { alert("已存在同名文件：" + filename); }
				else {
					stagePut(path, content, "chore: upload post " + filename);
					state.items.push({ name: filename, path: path, type: "file" });
				}
				renderList();
				// 直接打开刚上传的文章进入编辑
				openItem({ name: filename, path: path, type: "file" });
			};
			reader.readAsText(file);
		});
		input.click();
	}

	// ---------- 新增/保存/删除（列表型） ----------

	function addItem() {
		var s = state.schema;
		var it = {};
		s.fields.forEach(function (f) {
			if (f.hidden) return;
			if (f.type === "boolean") it[f.key] = false;
			else if (f.type === "tags") it[f.key] = [];
			else if (f.type === "object") it[f.key] = {};
			else if (f.type === "object-list") it[f.key] = [];
			else it[f.key] = "";
		});
		// 自动为隐藏的 id 字段（动态/友链等）生成自增 id，防止新建项缺 id 导致评论区等依赖 id 的功能失效
if (s.format === "ts-array") {
  s.fields.forEach(function (f) {
    if (f.hidden && f.key === "id" && f.type === "number") {
      var maxId = 0;
      state.items.forEach(function (e) { if (e && typeof e.id === "number" && e.id > maxId) maxId = e.id; });
      it.id = maxId + 1;
    }
  });
}
if (s.format === "ts-array") state.items.push(it);
		else if (s.format === "ts-object") { state.items = [it]; }
		state.current = it;
		renderList();
		renderForm();
	}

	function saveItem() {
		var s = state.schema;
		try {
			var newSource;
			if (s.format === "md-posts") {
				var d = state.current.data;
				// 保留内部字段
				(s.preserveFields || []).forEach(function (k) { if (state.current.data[k] === undefined) { /* 无则不写 */ } });
				newSource = window.EditorMd.stringify(d, state.current.body);
			} else if (s.format === "md-file") {
				var body = state.current && typeof state.current.body === "string" ? state.current.body : state.body;
				newSource = window.EditorMd.stringify(state.data, body);
			} else if (s.format === "ts-map") {
				// 重组动态键名对象
				var map = {};
				state.items.forEach(function (cat) { map[cat.key] = cat.items; });
				newSource = window.EditorTsIO.replace(state.rawSource, s.varName, map);
			} else {
				newSource = window.EditorTsIO.replace(state.rawSource, s.varName, s.format === "ts-array" ? state.items : state.data);
			}
			if (newSource === null) throw new Error("生成源码失败");
			if (state.rawSha) {
				// BOM 处理
				if (s.bom && newSource.charAt(0) !== "\uFEFF") newSource = "\uFEFF" + newSource;
			}
			showDiff(state.rawSource, newSource, function () {
				var path = s.format === "md-posts" ? state.current.file.path : s.path;
				state.rawSource = newSource;
				stagePut(path, newSource, "chore(editor): update " + path);
			});
		} catch (e) {
			alert("保存前校验失败：" + e.message);
		}
	}

	function deleteItem() {
		var s = state.schema;
		var label = itemLabel(s, state.current, 0);
		if (!confirm("确认删除「" + label + "」？删除将在「统一推送」时生效")) return;
		if (s.format === "md-posts") {
			stageDelete(state.current.file.path, "chore(editor): delete post");
			state.items = state.items.filter(function (it) { return it !== state.current.file; });
			renderList();
			$(".ed-panel").innerHTML = "";
		} else {
			// 数组/对象：从数据中移除
			if (s.format === "ts-array") {
				var idx = state.items.indexOf(state.current);
				if (idx > -1) state.items.splice(idx, 1);
			} else if (s.format === "ts-object") {
				// 公告不提供删除（单对象）
				return;
			}
			var newSource = window.EditorTsIO.replace(state.rawSource, s.varName, s.format === "ts-array" ? state.items : state.data);
			state.rawSource = newSource;
			stagePut(s.path, newSource, "chore(editor): delete item");
			renderList();
			$(".ed-panel").innerHTML = "";
		}
	}

	// ---------- diff 预览 ----------

	function showDiff(oldSrc, newSrc, onConfirm) {
		var ov = document.createElement("div");
		ov.className = "yuj-editor-overlay";
		var box = document.createElement("div");
		box.className = "ed-diff";
		box.innerHTML =
			"<h3>暂存前预览（左：当前 右：新内容）</h3>" +
			"<div class='ed-diff-cols'><pre class='ed-diff-pre'>" + esc(oldSrc) + "</pre><pre class='ed-diff-pre'>" + esc(newSrc) + "</pre></div>" +
			"<div class='ed-actions'><button class='ef-btn' id='ed-diff-cancel'>取消</button><button class='ef-btn ef-btn-primary' id='ed-diff-ok'>确认保存</button></div>";
		ov.appendChild(box);
		document.body.appendChild(ov);
		$("#ed-diff-cancel", box).addEventListener("click", function () { document.body.removeChild(ov); });
		$("#ed-diff-ok", box).addEventListener("click", function () { document.body.removeChild(ov); onConfirm(); });
	}

	function el(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text !== undefined) e.textContent = text;
		return e;
	}

	// ---------- 启动 ----------

	function pageName() {
		var m = /\/admin\/([^/?#]+)/.exec(location.pathname);
		return m ? m[1] : "";
	}

	function init() {
		var schema = window.getSchema(pageName());
		if (!schema) {
			document.body.innerHTML = "<div style='padding:40px;font-family:sans-serif'>未知编辑器页面。请从站点导航栏 logo 进入。<br><a href='/" + "'>返回首页</a></div>";
			return;
		}
		state.schema = schema;
		var root = $("#editor-root");
		root.innerHTML =
			"<header class='ed-header'></header>" +
			"<div class='ed-body'><div class='ed-list'></div><div class='ed-panel'><div class='ed-loading'>加载中…</div></div></div>";
		renderHeader();
		renderPages();
		loadData().then(function () {
			renderList();
			if (state.items.length > 0) selectItem(0);
			else if (schema.format === "md-file") {
				state.current = Object.assign({}, state.data, { body: state.body || "" });
				renderForm();
			}
		}).catch(function (e) {
			$(".ed-panel").innerHTML = "<div class='ed-error'>" + esc(e.message) + "</div>";
		});
		window.EditorPages = renderPages;
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
