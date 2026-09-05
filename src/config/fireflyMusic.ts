// Firefly 音乐页面配置（从 https://github.com/Seasir-Hyde/Firefly-hyde 移植）
// 仅服务于 /music 音乐可视化页面，与 Mizuki 自带的 APlayer 侧边播放器互不干扰。

// 音乐可视化配置
export const musicVisualizerConfig = {
	// 振幅倍数
	amplitude: 1.5,
	// 频谱平滑系数 (0-1)
	smoothing: 0.8,
	// FFT 大小 (32-32768, 必须是 2 的幂)
	fftSize: 256,
	// 地形网格密度
	gridSize: 64,
	// 自动旋转速度 (弧度/秒)
	rotationSpeed: 0.2,
	// 页面背景色（按明暗主题）
	background: {
		dark: "#0a0a15",
		light: "#ffffff",
	},
};

// 音乐播放器配置（仅网易云 meting 模式，api.qijieya.cn 解灰直链）
export const musicPlayerConfig = {
	// 默认音量 (0-1)
	volume: 0.7,

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode: "list",

	// 是否显示歌词
	showLyrics: true,

	// Meting API 配置（网易云歌单）
	meting: {
		// Meting API 地址
		api: "https://api.qijieya.cn/meting/?server=:server&type=:type&id=:id",
		// 音乐平台：netease=网易云音乐
		server: "netease",
		// 类型：playlist=歌单
		type: "playlist",
		// 歌单 ID（可换成你自己的网易云歌单 ID）
		id: "17889813127",
		// 认证 token（可选）
		auth: "",
		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis: [
			"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
			"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
		],
	},
};
