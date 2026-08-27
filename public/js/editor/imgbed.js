/**
 * imgbed：上传图片到你自己的 CloudFlare-ImgBed 图床，返回可访问 URL。
 * 在文章编辑页用于「上传图片到图床」按钮，成功后把 URL 以 ![](url) 插入 Markdown。
 *
 * 安全说明：图床管理员 token 仅存于浏览器 localStorage（你自己用编辑器时填一次），
 * 绝不写进仓库代码 / 不出现在网络请求的静态资源里，避免 token 泄露。
 *
 * 如需调整图床接入参数，改下面 CONFIG 即可：
 *   base        图床域名
 *   uploadApi   上传接口路径
 *   authHeader  token 放置的 HTTP 头（CloudFlare-ImgBed 默认 Authorization: Bearer）
 *   tokenQuery  若图床用 query 参数传 token（如 ?token=），填此键名；否则留空
 *   urlField    返回 JSON 中图片 URL 的字段路径，支持点号嵌套，如 "data.url"
 */
(function () {
	"use strict";

	var CONFIG = {
		base: "https://img.yujingblog.top",
		uploadApi: "/api/v1/upload",
		authHeader: "Authorization",          // 形如 "Authorization: Bearer <token>"
		authScheme: "Bearer",                 // token 前缀；若图床要裸 token 改为 ""
		tokenQuery: "",                       // 非空则用 query 传 token（键名），如 "token" 或 "admin_token"
		urlField: "data.url",                 // 返回 JSON 里图片 URL 的路径
		lsKey: "editor_imgbed_token",         // localStorage 键
		maxSize: 2000,                        // 压缩后长边上限
		quality: 0.85                         // webp 质量
	};

	function getToken() {
		try { return localStorage.getItem(CONFIG.lsKey) || ""; } catch (e) { return ""; }
	}
	function setToken(t) {
		try { localStorage.setItem(CONFIG.lsKey, t); } catch (e) {}
	}

	// 弹窗让用户输入 token（仅首次或 token 缺失时）
	function ensureToken() {
		var t = getToken();
		if (t) return Promise.resolve(t);
		return new Promise(function (resolve) {
			var input = prompt("请输入你的图床 API Token（在图床后台 系统设置→API Token 获取，仅存于本浏览器）");
			if (input && input.trim()) { setToken(input.trim()); resolve(input.trim()); }
			else { resolve(""); }
		});
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
