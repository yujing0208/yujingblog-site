/**
 * GitHub REST API 封装（编辑器运行时）
 * 全部走 Contents API；批量操作走 Git Data API。
 */
(function () {
	"use strict";

	var API = "https://api.github.com";

	function getPat() {
		try { return sessionStorage.getItem("yuj_editor_pat") || ""; } catch (e) { return ""; }
	}

	function headers(extra) {
		var h = {
			"Authorization": "Bearer " + getPat(),
			"Accept": "application/vnd.github+json",
			"User-Agent": "yujing-blog-editor",
		};
		if (extra) Object.assign(h, extra);
		return h;
	}

	function enc(path) {
		// 逐段编码，段间保留 "/"
		return path.split("/").map(function (seg) {
			return encodeURIComponent(seg);
		}).join("/");
	}

	function handle(res, label) {
		if (res.ok) return res.json();
		return res.json().then(function (j) {
			throw new Error((j.message || "请求失败") + (label ? " (" + label + ")" : ""));
		});
	}

	/** 读取文件 → { sha, content }，content 为 UTF-8 文本（保留 BOM），404 返回 null */
	function getFile(owner, repo, path, branch) {
		var url = API + "/repos/" + owner + "/" + repo + "/contents/" + enc(path) + (branch ? "?ref=" + branch : "");
		return fetch(url, { headers: headers() }).then(function (r) {
			if (r.status === 404) return null;
			return handle(r, path).then(function (j) {
				var text = "";
				if (j.content) {
					var bin = atob(j.content.replace(/\s/g, ""));
					var bytes = new Uint8Array(bin.length);
					for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
					text = new TextDecoder("utf-8").decode(bytes);
				}
				return { sha: j.sha, content: text, size: j.size };
			});
		});
	}

	function toBase64(str) {
		var bytes = new TextEncoder().encode(str);
		var bin = "";
		bytes.forEach(function (b) { bin += String.fromCharCode(b); });
		return btoa(bin);
	}

	/** 写入文本文件（已存在自动带 sha） */
	function putFile(owner, repo, path, content, message, branch) {
		return getFile(owner, repo, path, branch).then(function (old) {
			var payload = {
				message: message || "chore: update via online editor",
				branch: branch || "master",
				content: toBase64(content),
			};
			if (old && old.sha) payload.sha = old.sha;
			return fetch(API + "/repos/" + owner + "/" + repo + "/contents/" + enc(path), {
				method: "PUT",
				headers: headers({ "Content-Type": "application/json" }),
				body: JSON.stringify(payload),
			}).then(function (r) { return handle(r, path); });
		});
	}

	/** 删除文件 */
	function deleteFile(owner, repo, path, message, branch) {
		return getFile(owner, repo, path, branch).then(function (old) {
			if (!old) return null;
			var payload = { message: message || "chore: delete via online editor", branch: branch || "master", sha: old.sha };
			return fetch(API + "/repos/" + owner + "/" + repo + "/contents/" + enc(path), {
				method: "DELETE",
				headers: headers({ "Content-Type": "application/json" }),
				body: JSON.stringify(payload),
			}).then(function (r) { return handle(r, path); });
		});
	}

	/** 列出目录 → [{name,type,path,sha}] */
	function listDir(owner, repo, path, branch) {
		var url = API + "/repos/" + owner + "/" + repo + "/contents/" + enc(path) + (branch ? "?ref=" + branch : "");
		return fetch(url, { headers: headers() }).then(function (r) {
			if (r.status === 404) return [];
			return handle(r, path).then(function (arr) {
				if (!Array.isArray(arr)) return [];
				return arr.map(function (it) { return { name: it.name, type: it.type, path: it.path, sha: it.sha }; });
			});
		});
	}

	/** 上传图片（base64 由调用方传入） */
	function putBinary(owner, repo, path, base64, message, branch) {
		return getFile(owner, repo, path, branch).then(function (old) {
			var payload = {
				message: message || "chore: upload via online editor",
				branch: branch || "master",
				content: base64,
			};
			if (old && old.sha) payload.sha = old.sha;
			return fetch(API + "/repos/" + owner + "/" + repo + "/contents/" + enc(path), {
				method: "PUT",
				headers: headers({ "Content-Type": "application/json" }),
				body: JSON.stringify(payload),
			}).then(function (r) { return handle(r, path); });
		});
	}

	/**
	 * Git Data API：一次提交多个文件变更（新增/修改/删除）
	 * changes: [{ path, content? | base64? | delete? }]
	 * 返回 { commitSha }
	 */
	function commitTree(owner, repo, branch, changes, message) {
		// 注意：GET 单引用端点用单数 /git/ref/heads/{branch}；
		//      更新引用（PATCH）端点必须用复数 /git/refs/heads/{branch}，否则返回 404 Not Found (ref-update)
		var refUrl = API + "/repos/" + owner + "/" + repo + "/git/ref/heads/" + branch;
		var refUpdateUrl = API + "/repos/" + owner + "/" + repo + "/git/refs/heads/" + branch;
		return fetch(refUrl, { headers: headers() })
			.then(function (r) { return handle(r, "ref"); })
			.then(function (ref) {
				return fetch(API + "/repos/" + owner + "/" + repo + "/git/commits/" + ref.object.sha, { headers: headers() })
					.then(function (r) { return handle(r, "commit"); })
					.then(function (commit) {
						var baseTreeSha = commit.tree.sha;
						var parentSha = commit.sha;
						// 1. 创建 blob
						var blobReqs = changes.map(function (c) {
							if (c.delete) return Promise.resolve(null);
							var content = c.base64 || toBase64(c.content);
							return fetch(API + "/repos/" + owner + "/" + repo + "/git/blobs", {
								method: "POST",
								headers: headers({ "Content-Type": "application/json" }),
								body: JSON.stringify({ content: content, encoding: "base64" }),
							}).then(function (r) { return handle(r, "blob:" + c.path); })
								.then(function (b) { return { path: c.path, mode: "100644", type: "blob", sha: b.sha }; });
						});
						return Promise.all(blobReqs).then(function (newItems) {
							var items = newItems.filter(Boolean);
							// 2. 取当前完整树，保留未变更文件、剔除被删除文件
							return fetch(API + "/repos/" + owner + "/" + repo + "/git/trees/" + baseTreeSha + "?recursive=1", { headers: headers() })
								.then(function (r) { return handle(r, "tree"); })
								.then(function (tree) {
									var keep = (tree.tree || []).filter(function (t) {
										if (t.type !== "blob") return false;
										if (changes.some(function (c) { return c.delete && c.path === t.path; })) return false;
										if (items.some(function (it) { return it.path === t.path; })) return false;
										return true;
									}).map(function (t) {
										return { path: t.path, mode: "100644", type: "blob", sha: t.sha };
									});
									var finalTree = keep.concat(items);
									// 3. 建新 tree
									return fetch(API + "/repos/" + owner + "/" + repo + "/git/trees", {
										method: "POST",
										headers: headers({ "Content-Type": "application/json" }),
										body: JSON.stringify({ base_tree: baseTreeSha, tree: finalTree }),
									}).then(function (r) { return handle(r, "tree-create"); });
								});
						}).then(function (newTree) {
							// 4. 建 commit
							return fetch(API + "/repos/" + owner + "/" + repo + "/git/commits", {
								method: "POST",
								headers: headers({ "Content-Type": "application/json" }),
								body: JSON.stringify({ message: message || "chore: batch update via online editor", tree: newTree.sha, parents: [parentSha] }),
							}).then(function (r) { return handle(r, "commit-create"); });
						}).then(function (newCommit) {
							// 5. 更新 ref（PATCH 端点为 /git/refs/ 复数）
							return fetch(refUpdateUrl, {
								method: "PATCH",
								headers: headers({ "Content-Type": "application/json" }),
								body: JSON.stringify({ sha: newCommit.sha, force: false }),
							}).then(function (r) { return handle(r, "ref-update"); })
								.then(function () { return { commitSha: newCommit.sha }; });
						});
					});
			});
	}

	window.EditorGit = {
		getFile: getFile,
		putFile: putFile,
		deleteFile: deleteFile,
		listDir: listDir,
		putBinary: putBinary,
		toBase64: toBase64,
		commitTree: commitTree,
	};
})();
