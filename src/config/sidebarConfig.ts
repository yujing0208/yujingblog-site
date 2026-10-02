import type { SidebarLayoutConfig } from "../types/config";

/**
 * 侧边栏布局配置
 * 用于控制侧边栏组件的显示、排序、动画和响应式行为
 * sidebar: 控制组件所在的侧边栏（left 或 right）。注意：移动端通常不显示右侧栏内容。若组件设置在 right，请确保 layout.position 为 "both"。
 */
export const sidebarLayoutConfig: SidebarLayoutConfig = {
	// 侧边栏组件属性配置列表
	properties: [
		{
			// 组件类型：用户资料组件
			type: "profile",
			// 组件位置："top" 表示固定在顶部
			position: "top",
			// CSS 类名，用于应用样式和动画
			class: "onload-animation",
			// 动画延迟时间（毫秒），用于错开动画效果
			animationDelay: 0,
		},
		{
			// 组件类型：公告组件
			type: "announcement",
			// 组件位置："top" 表示固定在顶部
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 50,
		},
		{
			// 组件类型：侧栏音乐组件
			type: "music-sidebar",
			position: "sticky",
			class: "onload-animation",
			animationDelay: 100,
		},
		{
			// 组件类型：分类组件
			type: "categories",
			// 组件位置："sticky" 表示粘性定位，可滚动
			position: "sticky",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 150,
			// 响应式配置
			responsive: {
				// 折叠阈值：当分类数量超过5个时自动折叠
				collapseThreshold: 5,
			},
		},
		{
			// 组件类型：标签组件
			type: "tags",
			// 组件位置："sticky" 表示粘性定位
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 250,
			// 响应式配置
			responsive: {
				// 折叠阈值：当标签数量超过20个时自动折叠
				collapseThreshold: 20,
			},
		},
		{
			// 组件类型：每日一言组件(Hitokoto)
			type: "hitokoto",
			position: "top",
			class: "onload-animation",
			animationDelay: 300,
		},
		{
			// 组件类型：Umami 访问统计组件
			type: "umami-stats",
			// 组件位置："top" 表示固定在顶部
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 350,
		},
		{
			// 组件类型：卡片式目录组件
			type: "card-toc",
			// 组件位置
			position: "sticky",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 200,
		},
		{
			// FlatPaper 手账风个人名片（内页侧栏，flatpaper profile-card）
			type: "paper-profile",
			position: "top",
			class: "onload-animation",
			animationDelay: 0,
		},
		{
			// FlatPaper 手账风分类卡（内页侧栏，flatpaper categories-card）
			type: "paper-categories",
			position: "top",
			class: "onload-animation",
			animationDelay: 50,
		},
		{
			// FlatPaper 手账风标签云卡（内页侧栏，flatpaper tag-card）
			type: "paper-tags",
			position: "top",
			class: "onload-animation",
			animationDelay: 100,
		},
		{
			// FlatPaper「最新文章」卡（r15）：仅文章页左栏由 SidebarColumn 特判注入
			// （flatpaper sidebar-right.ejs is_post 分支：toc-card + latest-posts），
			// 不进 components.left，列表页不渲染
			type: "paper-latest",
			position: "sticky",
			class: "onload-animation",
			animationDelay: 150,
		},
		{
			// 组件类型：站点统计组件
			type: "site-stats",
			// 组件位置
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 200,
		},
		{
			// 组件类型：日历组件(移动端不显示)
			type: "calendar",
			// 组件位置
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 250,
		},
	],

	// 侧栏组件布局配置
	//   right: 手账首页右栏顺序 —— 音乐播放器 →（代码外）最近动态卡。
	//   按需求：删掉日历（calendar）、分类（categories）与站点统计（site-stats）组件；
	//   音乐组件放在「最近动态」下面（最近动态卡由 PaperHomeLayout 渲染在 RightSideBar 之后）。
	components: {
	left: [
		// FlatPaper 化内页侧栏（2026-09-27 Round 5）：
		// profile-card（名片+统计）→ categories-card（彩点分类）→ tag-card（胶带标签云）
		// 对齐 flatpaper sidebar-right.ejs；card-toc 保留（文章页目录，对应 flatpaper 文章页 toc-card）
		// announcement/hitokoto 从桌面内页侧栏撤下（drawer 移动端仍可见）；
		// umami-stats 于 2026-10-02 按需求加回（纸化重做后挂在标签卡后面）
		"paper-profile",
		"paper-categories",
		"paper-tags",
		"umami-stats",
		"card-toc",
	],
		right: ["music-sidebar"],
		drawer: ["profile", "announcement", "music-sidebar", "categories", "tags"],
	},

	// 默认动画配置
	defaultAnimation: {
		// 是否启用默认动画
		enable: true,
		// 基础延迟时间（毫秒）
		baseDelay: 0,
		// 递增延迟时间（毫秒），每个组件依次增加的延迟
		increment: 50,
	},

	// 响应式布局配置
	responsive: {
		// 断点配置（像素值）
		breakpoints: {
			// 移动端断点：屏幕宽度小于768px
			mobile: 768,
			// 平板端断点：屏幕宽度小于1280px
			tablet: 1280,
			// 桌面端断点：屏幕宽度大于等于1280px
			desktop: 1280,
		},
	},
};

