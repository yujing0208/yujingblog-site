/**
 * app：编辑器主应用
 * 入口：/admin/<page>-edit
 * 流程：解析 schema → 校验 PAT → 拉数据 → 列表+表单 → 保存（diff 预览）→ PUT
 */
(function () {
	"use strict";

	var SITE_BACK = "/"; // 返回站点默认
	var state = { schema: null, rawSource: "", rawSha: "", data: null, items: [], current: null };

	function $(s, root) { return (root || document).querySelector(s); }
	function $$(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }

	function esc(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	function getPat() { try { return sessionStorage.getItem("yuj_editor_pat") || ""; } catch (e) { return ""; } }
	function getFrom() { try { return sessionStorage.getItem("yuj_editor_from") || "/"; } catch (e) { return "/"; } }

	function goBack() {
		window.location.href = getFrom();
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
			"<button class='ef-btn' id='ed-logout'>退出编辑</button>" +
			"</div>";
		$("#ed-back").addEventListener("click", goBack);
		$("#ed-logout").addEventListener("click", function () {
			sessionStorage.removeItem("yuj_editor_pat");
			goBack();
		});
		fetch("https://api.github.com/user", {
			headers: { "Authorization": "Bearer " + getPat(), "Accept": "application/vnd.github+json", "User-Agent": "yujing-blog-editor" },
		}).then(function (r) { return r.json(); }).then(function (u) {
			if (u && u.login) $("#ed-user").textContent = "👤 " + u.login;
		}).catch(function () { });
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
			if (!confirm("删除分类「" + cat.key + "」及其全部设备？")) return;
			var idx = state.items.indexOf(cat);
			if (idx > -1) state.items.splice(idx, 1);
			var newSource = null;
			try {
				var map = {};
				state.items.forEach(function (c) { map[c.key] = c.items; });
				newSource = window.EditorTsIO.replace(state.rawSource, s.varName, map);
			} catch (e) { alert(e.message); return; }
			window.EditorGit.putFile(s.owner, s.repo, s.path, newSource, "chore(editor): delete category", s.branch)
				.then(function () { alert("已删除分类"); location.reload(); })
				.catch(function (e) { alert(e.message); });
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
		// 正文区（文章/关于）
		if (s.format === "md-posts" || s.format === "md-file") {
			var bodyWrap = el("div", "ef-field");
			var bl = el("label", "ef-label", s.format === "md-posts" ? "正文（Markdown）" : "正文（Markdown）");
			var ta = document.createElement("textarea");
			ta.className = "ef-input ef-textarea ef-body";
			ta.rows = 16;
			ta.value = editing.body || "";
			ta.addEventListener("change", function () { editing.body = ta.value; });
			bodyWrap.appendChild(bl);
			bodyWrap.appendChild(ta);
			panel.appendChild(bodyWrap);
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
		window.EditorGit.putFile(s.owner, s.repo, s.path + "/" + name + "/info.json", JSON.stringify(info, null, 2), "chore: create album " + name, s.branch)
			.then(function () { return loadAlbums(); })
			.then(function () { renderList(); })
			.catch(function (e) { alert(e.message); });
	}

	function renderAlbumForm() {
		var s = state.schema;
		var panel = $(".ed-panel");
		var cur = state.current;
		panel.innerHTML = "";
		var h = el("div", "ed-panel-head");
		h.appendChild(el("h2", "ed-panel-title", "相册：" + esc(cur.dir.name)));
		panel.appendChild(h);
		// info.json 加载
		window.EditorGit.getFile(s.owner, s.repo, s.path + "/" + cur.dir.name + "/info.json", s.branch).then(function (f) {
			var info = {};
			if (f && f.content) { try { info = JSON.parse(f.content); } catch (e) { } cur.sha = f.sha; }
			cur.info = info;
			panel.appendChild(window.EditorForm.renderFields(s.fields, info, function () { }));
			var acts = el("div", "ed-actions");
			var save = el("button", "ef-btn ef-btn-primary", "💾 保存配置");
			save.addEventListener("click", function () {
				var content = JSON.stringify(info, null, 2);
				window.EditorGit.putFile(s.owner, s.repo, s.path + "/" + cur.dir.name + "/info.json", content, "chore: update album " + cur.dir.name, s.branch)
					.then(function () { alert("已保存，部署约 1-3 分钟生效"); })
					.catch(function (e) { alert(e.message); });
			});
			var upCover = el("button", "ef-btn", "🖼 上传封面");
			upCover.addEventListener("click", function () {
				var target = s.path + "/" + cur.dir.name + "/cover.webp";
				window.EditorUpload.pickForPath(target, function () { alert("封面已上传（cover.webp 优先于 cover.jpg）"); });
			});
			var addImg = el("button", "ef-btn", "➕ 上传图片");
			addImg.addEventListener("click", function () {
				var target = s.path + "/" + cur.dir.name + "/" + (prompt("图片文件名（不含下划线，用 - 代替）：") || "");
				if (!target.endsWith("/")) return;
				window.EditorUpload.pickForPath(target, function () { alert("已上传"); refreshImages(); });
			});
			var delAll = el("button", "ef-btn ef-btn-danger", "🗑 删除整个相册");
			delAll.addEventListener("click", function () { deleteAlbum(cur); });
			acts.appendChild(save);
			acts.appendChild(upCover);
			acts.appendChild(addImg);
			acts.appendChild(delAll);
			panel.appendChild(acts);
			refreshImages();
		});
	}

	function refreshImages() {
		var s = state.schema;
		var cur = state.current;
		var imgBox = $(".ed-images");
		if (!imgBox) {
			imgBox = el("div", "ed-images");
			imgBox.appendChild(el("h3", "ed-panel-title", "相册图片"));
			$(".ed-panel").appendChild(imgBox);
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
		var content = "---\ntitle: \"" + title.replace(/"/g, '\\"') + "\"\npublished: " + today + "\ndraft: true\ntags: []\ncategory: \"\"\n---\n\n# " + title + "\n";
		window.EditorGit.putFile(s.owner, s.repo, s.path + "/" + filename, content, "chore: new post " + filename, s.branch)
			.then(function () { return loadPosts(); })
			.then(function () { renderList(); })
			.catch(function (e) { alert(e.message); });
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
				newSource = window.EditorMd.stringify(state.data, state.body);
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
				window.EditorGit.putFile(s.owner, s.repo, path, newSource, "chore(editor): update " + path, s.branch)
					.then(function () { alert("已保存 ✅ 部署约 1-3 分钟生效"); state.rawSource = newSource; state.rawSha = null; })
					.catch(function (e) { alert("保存失败：" + e.message); });
			});
		} catch (e) {
			alert("保存前校验失败：" + e.message);
		}
	}

	function deleteItem() {
		var s = state.schema;
		var label = itemLabel(s, state.current, 0);
		if (!confirm("确认删除「" + label + "」？此操作不可撤销！")) return;
		if (s.format === "md-posts") {
			window.EditorGit.deleteFile(s.owner, s.repo, state.current.file.path, "chore(editor): delete post", s.branch)
				.then(function () { return loadPosts(); }).then(function () { renderList(); $(".ed-panel").innerHTML = ""; });
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
			window.EditorGit.putFile(s.owner, s.repo, s.path, newSource, "chore(editor): delete item", s.branch)
				.then(function () { alert("已删除"); location.reload(); })
				.catch(function (e) { alert(e.message); });
		}
	}

	// ---------- diff 预览 ----------

	function showDiff(oldSrc, newSrc, onConfirm) {
		var ov = document.createElement("div");
		ov.className = "yuj-editor-overlay";
		var box = document.createElement("div");
		box.className = "ed-diff";
		box.innerHTML =
			"<h3>保存前预览（左：当前 右：新内容）</h3>" +
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
		loadData().then(function () {
			renderList();
			if (state.items.length > 0) selectItem(0);
			else if (schema.format === "md-file") {
				state.current = state.data;
				state.body = state.body || "";
				renderForm();
			}
		}).catch(function (e) {
			$(".ed-panel").innerHTML = "<div class='ed-error'>" + esc(e.message) + "</div>";
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
