/**
 * GitHub REST API ��װ���༭������ʱ��
 * ȫ���� Contents API������������ Git Data API��
 *
 * v2�������¼�棩����������ٳ��� GitHub Token��
 * ��������ת���� /api/editor-github���ɷ���˴��� GH_TOKEN ȥ�� GitHub��
 * �������ֻ���� /api/editor-auth �·��� HttpOnly Cookie��
 */
(function () {
	"use strict";

	var API = "https://api.github.com";
	var PROXY = "/api/editor-github";

	/** �����װ���� https://api.github.com/xxx ת�� /api/editor-github?path=/xxx */
	function gfetch(url, opts) {
		opts = opts || {};
		var ghPath = String(url).replace(/^https:\/\/api\.github\.com/, "");
		var proxied = PROXY + "?path=" + encodeURIComponent(ghPath);
		return fetch(proxied, {
			method: opts.method || "GET",
			headers: opts.headers || headers(),
			body: opts.body,
			credentials: "same-origin",
		}).then(function (r) {
			// Cookie ���ڣ�֪ͨҳ�����µ�¼�����������û����� 401 ����
			if (r.status === 401 && window.EditorAuthGate && window.EditorAuthGate.require) {
				window.EditorAuthGate.require();
			}
			return r;
		});
	}

	function headers(extra) {
		var h = {
			"Accept": "application/vnd.github+json",
			"User-Agent": "yujing-blog-editor",
		};
		if (extra) Object.assign(h, extra);
		return h;
	}

	function enc(path) {
		// ��α��룬�μ䱣�� "/"
		return path.split("/").map(function (seg) {
			return encodeURIComponent(seg);
		}).join("/");
	}

	function handle(res, label) {
		if (res.ok) return res.json();
		return res.json().then(function (j) {
			throw new Error((j.message || "����ʧ��") + (label ? " (" + label + ")" : ""));
		});
	}

	/** ��ȡ�ļ� �� { sha, content }��content Ϊ UTF-8 �ı������� BOM����404 ���� null */
	function getFile(owner, repo, path, branch) {
		var url = API + "/repos/" + owner + "/" + repo + "/contents/" + enc(path) + (branch ? "?ref=" + branch : "");
		return gfetch(url).then(function (r) {
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

	/** д���ı��ļ����Ѵ����Զ��� sha�� */
	function putFile(owner, repo, path, content, message, branch) {
		return getFile(owner, repo, path, branch).then(function (old) {
			var payload = {
				message: message || "chore: update via online editor",
				branch: branch || "master",
				content: toBase64(content),
			};
			if (old && old.sha) payload.sha = old.sha;
			return gfetch(API + "/repos/" + owner + "/" + repo + "/contents/" + enc(path), {
				method: "PUT",
				headers: headers({ "Content-Type": "application/json" }),
				body: JSON.stringify(payload),
			}).then(function (r) { return handle(r, path); });
		});
	}

	/** ɾ���ļ� */
	function deleteFile(owner, repo, path, message, branch) {
		return getFile(owner, repo, path, branch).then(function (old) {
			if (!old) return null;
			var payload = { message: message || "chore: delete via online editor", branch: branch || "master", sha: old.sha };
			return gfetch(API + "/repos/" + owner + "/" + repo + "/contents/" + enc(path), {
				method: "DELETE",
				headers: headers({ "Content-Type": "application/json" }),
				body: JSON.stringify(payload),
			}).then(function (r) { return handle(r, path); });
		});
	}

	/** �г�Ŀ¼ �� [{name,type,path,sha}] */
	function listDir(owner, repo, path, branch) {
		var url = API + "/repos/" + owner + "/" + repo + "/contents/" + enc(path) + (branch ? "?ref=" + branch : "");
		return gfetch(url).then(function (r) {
			if (r.status === 404) return [];
			return handle(r, path).then(function (arr) {
				if (!Array.isArray(arr)) return [];
				return arr.map(function (it) { return { name: it.name, type: it.type, path: it.path, sha: it.sha }; });
			});
		});
	}

	/** �ϴ�ͼƬ��base64 �ɵ��÷����룩 */
	function putBinary(owner, repo, path, base64, message, branch) {
		return getFile(owner, repo, path, branch).then(function (old) {
			var payload = {
				message: message || "chore: upload via online editor",
				branch: branch || "master",
				content: base64,
			};
			if (old && old.sha) payload.sha = old.sha;
			return gfetch(API + "/repos/" + owner + "/" + repo + "/contents/" + enc(path), {
				method: "PUT",
				headers: headers({ "Content-Type": "application/json" }),
				body: JSON.stringify(payload),
			}).then(function (r) { return handle(r, path); });
		});
	}

	/**
	 * Git Data API��һ���ύ����ļ����������/�޸�/ɾ����
	 * changes: [{ path, content? | base64? | delete? }]
	 * ���� { commitSha }
	 */
	function commitTree(owner, repo, branch, changes, message) {
		// ע�⣺GET �����ö˵��õ��� /git/ref/heads/{branch}��
		//      �������ã�PATCH���˵�����ø��� /git/refs/heads/{branch}�����򷵻� 404 Not Found (ref-update)
		var refUrl = API + "/repos/" + owner + "/" + repo + "/git/ref/heads/" + branch;
		var refUpdateUrl = API + "/repos/" + owner + "/" + repo + "/git/refs/heads/" + branch;
		return gfetch(refUrl)
			.then(function (r) { return handle(r, "ref"); })
			.then(function (ref) {
				return gfetch(API + "/repos/" + owner + "/" + repo + "/git/commits/" + ref.object.sha)
					.then(function (r) { return handle(r, "commit"); })
					.then(function (commit) {
						var baseTreeSha = commit.tree.sha;
						var parentSha = commit.sha;
						// 1. ���� blob
						var blobReqs = changes.map(function (c) {
							if (c.delete) return Promise.resolve(null);
							var content = c.base64 || toBase64(c.content);
							return gfetch(API + "/repos/" + owner + "/" + repo + "/git/blobs", {
								method: "POST",
								headers: headers({ "Content-Type": "application/json" }),
								body: JSON.stringify({ content: content, encoding: "base64" }),
							}).then(function (r) { return handle(r, "blob:" + c.path); })
								.then(function (b) { return { path: c.path, mode: "100644", type: "blob", sha: b.sha }; });
						});
						return Promise.all(blobReqs).then(function (newItems) {
							var items = newItems.filter(Boolean);
							// 2. ȡ��ǰ������������δ����ļ����޳���ɾ���ļ�
							return gfetch(API + "/repos/" + owner + "/" + repo + "/git/trees/" + baseTreeSha + "?recursive=1")
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
								// 2b. base_tree ��̳�δ��ʽ�г����ļ���Ҫɾ��������ʽд {sha:null}
								changes.forEach(function (c) {
									if (c.delete) finalTree.push({ path: c.path, mode: "100644", type: "blob", sha: null });
								});
								// 3. ���� tree
								return gfetch(API + "/repos/" + owner + "/" + repo + "/git/trees", {
										method: "POST",
										headers: headers({ "Content-Type": "application/json" }),
										body: JSON.stringify({ base_tree: baseTreeSha, tree: finalTree }),
									}).then(function (r) { return handle(r, "tree-create"); });
								});
						}).then(function (newTree) {
							// 4. �� commit
							return gfetch(API + "/repos/" + owner + "/" + repo + "/git/commits", {
								method: "POST",
								headers: headers({ "Content-Type": "application/json" }),
								body: JSON.stringify({ message: message || "chore: batch update via online editor", tree: newTree.sha, parents: [parentSha] }),
							}).then(function (r) { return handle(r, "commit-create"); });
						}).then(function (newCommit) {
							// 5. ���� ref��PATCH �˵�Ϊ /git/refs/ ������
							return gfetch(refUpdateUrl, {
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

