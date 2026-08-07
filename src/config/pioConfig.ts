import type { PioConfig } from "../types/config";

// Pio 看板娘配置
export const pioConfig: PioConfig = {
	enable: true, // 启用看板娘
	models: ["/pio/models/NOIR/noir.model3.json"], // 默认模型路径
	position: "left", // 模型位置
	width: 280, // 默认宽度
	height: 250, // 默认高度
	mode: "draggable", // 默认为可拖拽模式
	hiddenOnMobile: true, // 默认在移动设备上隐藏
	hideAboutMenu: false, // 隐藏内置 About 菜单按钮
	hoverIntro: "YuJing的记忆终端 ✦ 诺瓦陪你逛博客喵~", // 悬停介绍
	dialog: {
		welcome: "欢迎来到主人的博客~诺瓦在这里等你喵~", // 欢迎词
		touch: [
			"喵呜！别、别突然摸我啦！",
			"咦……这样会害羞的喵~",
			"呜……我、我不讨厌啦，但是要提前说一声喵！",
			"嘿嘿，摸够了的话，要帮我顺顺毛哦~",
		], // 触摸提示
		home: "点这里就能回到首页啦喵~", // 首页提示
		skin: ["想看看我穿新衣服的样子吗喵？", "这件小裙子好看吗喵~"], // 换装提示
		close: "呜…要、要走了吗？下次再来找诺瓦玩哦喵~", // 关闭提示
		link: "https://github.com/yujing0208", // 关于链接
	},
};
