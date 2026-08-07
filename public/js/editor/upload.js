/**
 * upload：图片压缩 + 上传到 content 仓库 images/
 * 路径规则：images/uploads/YYYYMMDD_<随机>.webp（相册封面/相册图片单独传路径）
 */
(function () {
	"use strict";

	var CONTENT = { owner: "yujing0208", repo: "yujingblog-content", branch: "master" };

	function fileToDataUrl(file) {
		return new Promise(function (resolve, reject) {
			var r = new FileReader();
			r.onload = function () { resolve(r.result); };
			r.onerror = reject;
			r.readAsDataURL(file);
		});
	}

	/** Canvas 压缩：长边 ≤ maxSize，质量 quality，输出 dataURL(webp) */
	function compress(file, maxSize, quality) {
		return new Promise(function (resolve, reject) {
			if (!/^image\//.test(file.type)) { reject(new Error("不是图片文件")); return; }
			var img = new Image();
			var url = URL.createObjectURL(file);
			img.onload = function () {
				URL.revokeObjectURL(url);
				var w = img.width, h = img.height;
				var scale = Math.min(1, maxSize / Math.max(w, h));
				var cw = Math.max(1, Math.round(w * scale));
				var ch = Math.max(1, Math.round(h * scale));
				var canvas = document.createElement("canvas");
				canvas.width = cw; canvas.height = ch;
				var ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0, cw, ch);
				resolve(canvas.toDataURL("image/webp", quality));
			};
			img.onerror = reject;
			img.src = url;
		});
	}

	function dataUrlToBase64(dataUrl) {
		var i = dataUrl.indexOf(",");
		return dataUrl.slice(i + 1);
	}

	function today() {
		var d = new Date();
		return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
	}

	function rand() { return Math.random().toString(36).slice(2, 8); }

	/**
	 * 选择图片 → 压缩 → 上传 images/uploads/xxx.webp
	 * cb(url) 返回仓库内相对路径（站点用 /images/... 访问）
	 */
	function pickAndUpload(cb) {
		var input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = function () {
			var file = input.files && input.files[0];
			if (!file) return;
			compress(file, 2000, 0.85).then(function (dataUrl) {
				var base64 = dataUrlToBase64(dataUrl);
				var path = "images/uploads/" + today() + "_" + rand() + ".webp";
				return window.EditorGit.putBinary(CONTENT.owner, CONTENT.repo, path, base64, "chore: upload image via online editor", CONTENT.branch).then(function () {
					return path;
				});
			}).then(function (path) {
				if (cb) cb("/" + path);
			}).catch(function (e) {
				alert("上传失败：" + e.message);
			});
		};
		input.click();
	}

	/** 指定路径上传（相册用）：返回完整 base64（不带 data: 头） */
	function pickForPath(targetPath, cb) {
		var input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = function () {
			var file = input.files && input.files[0];
			if (!file) return;
			compress(file, 2000, 0.85).then(function (dataUrl) {
				var base64 = dataUrlToBase64(dataUrl);
				return window.EditorGit.putBinary(CONTENT.owner, CONTENT.repo, targetPath, base64, "chore: upload via online editor", CONTENT.branch).then(function () { return base64; });
			}).then(function (b64) { if (cb) cb(b64); })
				.catch(function (e) { alert("上传失败：" + e.message); });
		};
		input.click();
	}

	window.EditorUpload = {
		pickAndUpload: pickAndUpload,
		pickForPath: pickForPath,
		compress: compress,
		dataUrlToBase64: dataUrlToBase64,
	};
})();
