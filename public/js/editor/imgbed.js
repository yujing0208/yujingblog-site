/**
 * imgbed：上传图片到你的图床（Sanyue ImgHub），返回可访问 URL。
 * 在文章/关于编辑页、各类图片字段、相册页用于「上传图片到图床」按钮。
 *
 * 注意：token 已直接写死在下面 CONFIG.token（按你的要求）。这意味着图床上传权限
 * 对任何能打开本页面的人可见（查看网页源码即可拿到）。如担心滥用，请到图床后台
 * 吊销此 token 并替换为新值。
 *
 * 如需调整图床接入参数，改下面 CONFIG 即可：
 *   base        图床域名
 *   uploadApi   上传接口路径
 *   authHeader  token 放置的 HTTP 头
 *   tokenQuery  若图床用 query 参数传 token（如 ?token=），填此键名；否则留空
 *   urlField    返回 JSON 中图片 URL 的字段路径，支持点号嵌套
 */
(function () {
	"use strict";

	var CONFIG = {
		base: "https://img.yujingblog.top",
		uploadApi: "/upload",                  // Sanyue ImgHub 实际上传接口
		authHeader: "Authorization",          // 形如 "Authorization: Bearer <token>"
		authScheme: "Bearer",                 // token 前缀
		tokenQuery: "",                       // 非空则用 query 传 token（键名）
		urlField: "0.src",                    // 返回 JSON 数组，首项 src 为相对路径 /file/xxx
		token: "imgbed_7d675d35eba290f15714416efc9aa60ece523272f067c7be58ab5afeb847704f",
		maxSize: 2000,                        // 压缩后长边上限
		quality: 0.85                         // webp 质量
	};

	function getToken() { return CONFIG.token || ""; }
	function setToken(t) { CONFIG.token = t; }

	// 直接返回写死的 token（不再弹窗 / 不读 localStorage）
	function ensureToken() {
		return Promise.resolve(getToken());
	}

	// 从嵌套字段路径取值： "data.url" -> obj.data.url
	function pickField(obj, path) {
		return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
	}

	/** 选择图片 → 压缩 → 上传图床 → cb(url) */
	function pickAndUpload(cb) {
		var input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = function () {
			var file = input.files && input.files[0];
			if (!file) return;
			ensureToken().then(function (token) {
				if (!token) { alert("未提供图床 Token，已取消上传"); return; }
				// 压缩为 webp
				var compress = window.EditorUpload && window.EditorUpload.compress;
				var proceed = compress
					? compress(file, CONFIG.maxSize, CONFIG.quality)
					: Promise.resolve(file);
				return proceed.then(function (imgOrFile) {
					var fd = new FormData();
					if (typeof imgOrFile === "string") {
						// compress 返回 dataURL：转回 Blob 再上传
						var arr = imgOrFile.split(",");
						var mime = (arr[0].match(/:(.*?);/) || [, "image/webp"])[1];
						var bstr = atob(arr[1]);
						var n = bstr.length;
						var u8 = new Uint8Array(n);
						while (n--) u8[n] = bstr.charCodeAt(n);
						fd.append("file", new Blob([u8], { type: mime }), file.name.replace(/\.\w+$/, ".webp"));
					} else {
						fd.append("file", imgOrFile, file.name);
					}
					var url = CONFIG.base + CONFIG.uploadApi;
					if (CONFIG.tokenQuery) url += (url.indexOf("?") >= 0 ? "&" : "?") + CONFIG.tokenQuery + "=" + encodeURIComponent(token);
					var headers = {};
					if (CONFIG.authHeader && !CONFIG.tokenQuery) {
						headers[CONFIG.authHeader] = (CONFIG.authScheme ? CONFIG.authScheme + " " : "") + token;
					}
					return fetch(url, { method: "POST", body: fd, headers: headers })
						.then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
						.then(function (res) {
							var j = res.j;
							var imgUrl = pickField(j, CONFIG.urlField);
							// Sanyue ImgHub 返回相对路径 /file/xxx，需拼接 base 成完整 URL
							if (imgUrl && imgUrl.charAt(0) === "/") imgUrl = CONFIG.base + imgUrl;
							if (!imgUrl) throw new Error("图床未返回图片 URL（响应：" + JSON.stringify(j).slice(0, 200) + "）");
							if (cb) cb(imgUrl);
						});
				});
			}).catch(function (e) { alert("图床上传失败：" + e.message); });
		};
		input.click();
	}

	window.EditorImgBed = {
		CONFIG: CONFIG,
		getToken: getToken,
		setToken: setToken,
		pickAndUpload: pickAndUpload
	};
})();
