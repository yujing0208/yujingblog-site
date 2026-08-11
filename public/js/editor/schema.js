/**
 * schema：所有编辑器的数据源与字段定义
 * format:
 *   ts-array  —— data/xxx.ts 顶层数组（extract/replace by varName）
 *   ts-object —— data/xxx.ts 顶层对象（如 announcement）
 *   ts-map    —— data/xxx.ts 动态键名对象（如 devices）
 *   md-file   —— spec/*.md 单页（frontmatter + body）
 *   md-posts  —— posts/*.md 列表（frontmatter + body，CRUD + 新建）
 *   album     —— images/albums/<id>/ 文件夹（info.json + 封面 + 图片）
 * repo: content = yujingblog-content (master)
 */
(function () {
	"use strict";

	var CONTENT = { owner: "yujing0208", repo: "yujingblog-content", branch: "master" };

	window.EditorSchemas = {

		projects: {
			label: "项目",
			format: "ts-array",
			...CONTENT,
			path: "data/projects.ts",
			varName: "projectsData",
			itemLabel: "title",
			icon: "material-symbols:work",
			fields: [
				{ key: "title", label: "标题", type: "string", required: true },
				{ key: "id", label: "ID（英文短标识）", type: "string", required: true },
				{ key: "description", label: "描述", type: "text", required: true },
				{ key: "image", label: "封面", type: "image", placeholder: "https:// 外链或 /assets/ 本地路径" },
				{ key: "category", label: "分类", type: "select", options: ["web", "mobile", "desktop", "other"], required: true },
				{ key: "status", label: "状态", type: "select", options: ["completed", "in-progress", "planned"], required: true },
				{ key: "techStack", label: "技术栈", type: "tags", placeholder: "逗号分隔" },
				{ key: "startDate", label: "开始日期", type: "date", required: true },
				{ key: "endDate", label: "结束日期", type: "date", optional: true },
				{ key: "liveDemo", label: "在线演示", type: "string", optional: true },
				{ key: "sourceCode", label: "源码", type: "string", optional: true },
				{ key: "visitUrl", label: "访问链接", type: "string", optional: true },
				{ key: "featured", label: "置顶", type: "boolean", optional: true },
				{ key: "tags", label: "标签", type: "tags", optional: true, placeholder: "逗号分隔" },
				{ key: "showImage", label: "显示图片", type: "boolean", optional: true, hidden: true },
			],
		},

		friends: {
			label: "友链",
			format: "ts-array",
			...CONTENT,
			path: "data/friends.ts",
			varName: "friendsData",
			bom: true,
			itemLabel: "title",
			fields: [
				{ key: "title", label: "名称", type: "string", required: true },
				{ key: "imgurl", label: "头像", type: "image" },
				{ key: "desc", label: "描述", type: "text" },
				{ key: "siteurl", label: "网址", type: "string", required: true },
				{ key: "tags", label: "标签", type: "tags", placeholder: "逗号分隔" },
				{ key: "id", label: "ID", type: "number", hidden: true },
			],
		},

		website: {
			label: "网站导航",
			format: "ts-array",
			...CONTENT,
			path: "data/website.ts",
			varName: "websiteData",
			bom: true,
			itemLabel: "title",
			fields: [
				{ key: "title", label: "名称", type: "string", required: true },
				{ key: "imgurl", label: "图标", type: "image", placeholder: "图片外链 URL" },
				{ key: "desc", label: "描述", type: "text" },
				{ key: "siteurl", label: "网址", type: "string", required: true },
				{
					key: "category",
					label: "分类",
					type: "select",
					required: true,
					options: [
						{ value: "dev", label: "开发" },
						{ value: "project", label: "项目" },
						{ value: "design", label: "设计" },
						{ value: "ai", label: "AI" },
						{ value: "tool", label: "工具" },
						{ value: "resource", label: "资源" },
					],
				},
			],
		},

		timeline: {
			label: "时间线",
			format: "ts-array",
			...CONTENT,
			path: "data/timeline.ts",
			varName: "timelineData",
			itemLabel: "title",
			fields: [
				{ key: "title", label: "标题", type: "string", required: true },
				{ key: "id", label: "ID", type: "string", required: true },
				{ key: "description", label: "描述", type: "text" },
				{ key: "type", label: "类型", type: "select", options: ["education", "work", "project", "achievement", ""] },
				{ key: "startDate", label: "开始日期", type: "date", required: true },
				{ key: "endDate", label: "结束日期", type: "date", optional: true },
				{ key: "location", label: "地点", type: "string", optional: true },
				{ key: "organization", label: "组织", type: "string", optional: true },
				{ key: "position", label: "职位", type: "string", optional: true },
				{ key: "skills", label: "技能", type: "tags", optional: true },
				{ key: "achievements", label: "成就", type: "tags", optional: true },
				{ key: "links", label: "链接", type: "object-list", optional: true, itemLabel: "name", itemFields: [
					{ key: "name", label: "名称", type: "string" },
					{ key: "url", label: "地址", type: "string" },
					{ key: "type", label: "类型", type: "string" },
				]},
				{ key: "icon", label: "图标", type: "string", optional: true },
				{ key: "color", label: "颜色", type: "color", optional: true },
				{ key: "featured", label: "精选", type: "boolean", optional: true },
			],
		},

		diary: {
			label: "日记",
			format: "ts-array",
			...CONTENT,
			path: "data/diary.ts",
			varName: "diaryData",
			bom: true,
			itemLabel: function (it) { return (it.date || "") + (it.content ? " · " + it.content.slice(0, 20) : ""); },
			fields: [
				{ key: "content", label: "内容", type: "text", required: true },
				{ key: "date", label: "日期", type: "datetime", required: true, placeholder: "2026-07-26T20:58:00+08:00" },
				{ key: "images", label: "图片", type: "tags", optional: true, placeholder: "URL，逗号分隔" },
				{ key: "location", label: "地点", type: "string", optional: true },
				{ key: "mood", label: "心情", type: "string", optional: true },
				{ key: "tags", label: "标签", type: "tags", optional: true },
				{ key: "imgMode", label: "图片模式", type: "select", options: ["", "mode-mid", "mode-grid"], optional: true },
				{ key: "id", label: "ID", type: "number", hidden: true },
			],
		},

		anime: {
			label: "追番",
			format: "ts-array",
			...CONTENT,
			path: "data/anime.ts",
			varName: "localAnimeList",
			itemLabel: "title",
			fields: [
				{ key: "title", label: "标题", type: "string", required: true },
				{ key: "status", label: "状态", type: "select", options: ["watching", "completed", "planned", "onhold", "dropped"], required: true },
				{ key: "category", label: "类别", type: "select", options: ["anime", "novel", "game"], required: true },
				{ key: "rating", label: "评分", type: "number", required: true, step: 0.1 },
				{ key: "cover", label: "封面", type: "image" },
				{ key: "description", label: "简介", type: "text" },
				{ key: "episodes", label: "集数文本", type: "string", placeholder: "如 22 episodes" },
				{ key: "year", label: "年份", type: "string" },
				{ key: "genre", label: "类型", type: "tags" },
				{ key: "studio", label: "制作", type: "string" },
				{ key: "link", label: "链接", type: "string" },
				{ key: "progress", label: "看到", type: "number" },
				{ key: "totalEpisodes", label: "总集数", type: "number" },
			],
		},

		announcement: {
			label: "公告",
			format: "ts-object",
			...CONTENT,
			path: "data/announcement.ts",
			varName: "announcementData",
			itemLabel: "title",
			fields: [
				{ key: "title", label: "标题（可为空）", type: "string" },
				{ key: "closable", label: "可关闭", type: "boolean" },
				{ key: "interval", label: "轮播间隔（毫秒）", type: "number", optional: true },
				{ key: "link", label: "全局默认链接", type: "object", optional: true, fields: [
					{ key: "enable", label: "启用链接", type: "boolean" },
					{ key: "text", label: "链接文字", type: "string" },
					{ key: "url", label: "链接地址", type: "string" },
					{ key: "external", label: "外部链接", type: "boolean" },
				]},
			],
			// content 字段特殊处理（混合字符串/对象数组）
			contentField: "content",
		},

		devices: {
			label: "设备",
			format: "ts-map",
			...CONTENT,
			path: "data/devices.ts",
			varName: "devicesData",
			itemLabel: "name",
			fields: [
				{ key: "name", label: "名称", type: "string", required: true },
				{ key: "image", label: "图片", type: "image" },
				{ key: "specs", label: "规格", type: "string" },
				{ key: "description", label: "描述", type: "text" },
				{ key: "link", label: "链接", type: "string" },
			],
		},

		footprints: {
			label: "足迹",
			format: "ts-array",
			...CONTENT,
			path: "data/footprints.ts",
			varName: "footprintsData",
			itemLabel: "name",
			fields: [
				{ key: "name", label: "地点名称", type: "string", required: true },
				{ key: "coordinates", label: "坐标（经度, 纬度）", type: "pair", required: true, placeholder: "如 117.23, 31.82（高德拾取器 https://lbs.amap.com/tools/picker）" },
				{ key: "categories", label: "分类", type: "tags", optional: true, placeholder: "逗号分隔；含「计划」不参与省份高亮" },
				{ key: "date", label: "到访日期", type: "date", optional: true },
				{ key: "description", label: "简介", type: "text", optional: true },
				{ key: "photos", label: "照片", type: "tags", optional: true, placeholder: "URL，逗号分隔" },
				{ key: "markerColor", label: "标记颜色", type: "select", options: ["sunset", "ocean", "violet", "forest", "amber", "citrus"], optional: true },
				{ key: "url", label: "链接", type: "string", optional: true },
				{ key: "urlLabel", label: "链接文字", type: "string", optional: true },
			],
		},

		about: {
			label: "关于我",
			format: "md-file",
			...CONTENT,
			path: "spec/about.md",
			itemLabel: "title",
			fields: [
				{ key: "title", label: "标题", type: "string" },
				{ key: "description", label: "描述", type: "string" },
			],
		},

		post: {
			label: "文章",
			format: "md-posts",
			...CONTENT,
			path: "posts",
			itemLabel: "title",
			fields: [
				{ key: "title", label: "标题", type: "string", required: true },
				{ key: "published", label: "发布日期", type: "date", required: true },
				{ key: "updated", label: "更新日期", type: "date", optional: true },
				{ key: "draft", label: "草稿", type: "boolean" },
				{ key: "description", label: "摘要", type: "text" },
				{ key: "image", label: "封面", type: "image" },
				{ key: "tags", label: "标签", type: "tags" },
				{ key: "category", label: "分类", type: "select", options: ["折腾记录", "博客折腾", "博客更新", "软件推荐", "教程", "杂谈", ""], creatable: true },
				{ key: "lang", label: "语言", type: "string" },
				{ key: "pinned", label: "置顶", type: "boolean" },
				{ key: "comment", label: "允许评论", type: "boolean", default: true },
				{ key: "priority", label: "优先级", type: "number", optional: true },
				{ key: "author", label: "作者", type: "string" },
				{ key: "sourceLink", label: "来源链接", type: "string", optional: true },
				{ key: "licenseName", label: "许可名称", type: "string", optional: true },
				{ key: "licenseUrl", label: "许可链接", type: "string", optional: true },
				{ key: "encrypted", label: "加密", type: "boolean" },
				{ key: "password", label: "密码", type: "string", optional: true },
				{ key: "passwordHint", label: "密码提示", type: "string", optional: true },
				{ key: "hideHomeContent", label: "首页隐藏正文", type: "boolean", optional: true },
				{ key: "alias", label: "别名", type: "string", optional: true },
				{ key: "permalink", label: "自定义链接", type: "string", optional: true },
				// 内部保留字段（不出表单，保存时保留）
			],
			preserveFields: ["aiSummary", "prevTitle", "prevSlug", "nextTitle", "nextSlug"],
		},

		albums: {
			label: "相册",
			format: "album",
			...CONTENT,
			path: "images/albums",
			itemLabel: "title",
			fields: [
				{ key: "title", label: "标题", type: "string", required: true },
				{ key: "description", label: "描述", type: "text" },
				{ key: "date", label: "日期", type: "date", required: true },
				{ key: "location", label: "地点", type: "string" },
				{ key: "tags", label: "标签", type: "tags" },
				{ key: "password", label: "访问密码（留空=不加密）", type: "string", optional: true },
				{ key: "passwordHint", label: "密码提示", type: "string", optional: true },
			],
		},
	};

	/** 取 schema（兼容 xxx-edit 后缀 + 单复数别名） */
	window.getSchema = function (page) {
		var p = String(page || "").replace(/-edit$/, "");
		var s = window.EditorSchemas[p];
		if (s) return s;
		// 别名兼容：单数 / 复数
		var alias = { "websites": "website", "album": "albums" };
		if (alias[p]) return window.EditorSchemas[alias[p]] || null;
		return null;
	};
})();
