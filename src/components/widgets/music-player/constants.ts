import type { Song } from "./types";

export const STORAGE_KEY_VOLUME = "music-player-volume";
export const DEFAULT_VOLUME = 0.7;

export const LOCAL_PLAYLIST: Song[] = [
	{
		id: 3,
		title: "其实",
		artist: "薛之谦",
		cover: "assets/music/cover/其实-薛之谦.jpg",
		url: "assets/music/url/其实-薛之谦.mp3",
		lrc: "assets/music/lrc/其实-薛之谦.lrc",
		duration: 0,
	},
	{
		id: 4,
		title: "反方向的钟",
		artist: "周杰伦",
		cover: "assets/music/cover/反方向的钟-周杰伦.jpg",
		url: "assets/music/url/反方向的钟-周杰伦.mp3",
		lrc: "assets/music/lrc/反方向的钟-周杰伦.lrc",
		duration: 0,
	},
	{
		id: 5,
		title: "发如雪",
		artist: "周杰伦",
		cover: "assets/music/cover/发如雪-周杰伦.jpg",
		url: "assets/music/url/发如雪-周杰伦.mp3",
		lrc: "assets/music/lrc/发如雪-周杰伦.lrc",
		duration: 0,
	},
	{
		id: 6,
		title: "如果可以",
		artist: "韦礼安",
		cover: "assets/music/cover/如果可以-韦礼安.jpg",
		url: "assets/music/url/如果可以-韦礼安.mp3",
		lrc: "assets/music/lrc/如果可以-韦礼安.lrc",
		duration: 0,
	},
	{
		id: 7,
		title: "当你",
		artist: "林俊杰",
		cover: "assets/music/cover/当你-林俊杰.jpg",
		url: "assets/music/url/当你-林俊杰.mp3",
		lrc: "assets/music/lrc/当你-林俊杰.lrc",
		duration: 0,
	},
	{
		id: 8,
		title: "心似烟火",
		artist: "苏星婕",
		cover: "assets/music/cover/心似烟火-苏星婕.jpg",
		url: "assets/music/url/心似烟火-苏星婕.mp3",
		lrc: "assets/music/lrc/心似烟火-苏星婕.lrc",
		duration: 0,
	},
	{
		id: 9,
		title: "心墙",
		artist: "郭静",
		cover: "assets/music/cover/心墙-郭静.jpg",
		url: "assets/music/url/心墙-郭静.mp3",
		lrc: "assets/music/lrc/心墙-郭静.lrc",
		duration: 0,
	},
	{
		id: 10,
		title: "我怀念的",
		artist: "孙燕姿",
		cover: "assets/music/cover/我怀念的-孙燕姿.jpg",
		url: "assets/music/url/我怀念的-孙燕姿.mp3",
		lrc: "assets/music/lrc/我怀念的-孙燕姿.lrc",
		duration: 0,
	},
	{
		id: 11,
		title: "把回忆拼好给你（正版授权）",
		artist: "苏星婕",
		cover: "assets/music/cover/把回忆拼好给你正版授权-苏星婕.jpg",
		url: "assets/music/url/把回忆拼好给你正版授权-苏星婕.mp3",
		lrc: "assets/music/lrc/把回忆拼好给你正版授权-苏星婕.lrc",
		duration: 0,
	},
	{
		id: 12,
		title: "搁浅",
		artist: "周杰伦",
		cover: "assets/music/cover/搁浅-周杰伦.jpg",
		url: "assets/music/url/搁浅-周杰伦.mp3",
		lrc: "assets/music/lrc/搁浅-周杰伦.lrc",
		duration: 0,
	},
	{
		id: 13,
		title: "无人之岛",
		artist: "任然",
		cover: "assets/music/cover/无人之岛-任然.jpg",
		url: "assets/music/url/无人之岛-任然.mp3",
		lrc: "assets/music/lrc/无人之岛-任然.lrc",
		duration: 0,
	},
	{
		id: 14,
		title: "最后一页",
		artist: "江语晨",
		cover: "assets/music/cover/最后一页-江语晨.jpg",
		url: "assets/music/url/最后一页-江语晨.mp3",
		lrc: "assets/music/lrc/最后一页-江语晨.lrc",
		duration: 0,
	},
	{
		id: 15,
		title: "最长的电影",
		artist: "周杰伦",
		cover: "assets/music/cover/最长的电影-周杰伦.jpg",
		url: "assets/music/url/最长的电影-周杰伦.mp3",
		lrc: "assets/music/lrc/最长的电影-周杰伦.lrc",
		duration: 0,
	},
	{
		id: 16,
		title: "海屿你",
		artist: "Sixteen",
		cover: "assets/music/cover/海屿你-Sixteen.jpg",
		url: "assets/music/url/海屿你-Sixteen.mp3",
		lrc: "assets/music/lrc/海屿你-Sixteen.lrc",
		duration: 0,
	},
	{
		id: 18,
		title: "第57次取消发送",
		artist: "菲菲公主（陆绮菲）",
		cover: "assets/music/cover/第57次取消发送-菲菲公主陆绮菲.jpg",
		url: "assets/music/url/第57次取消发送-菲菲公主陆绮菲.mp3",
		lrc: "assets/music/lrc/第57次取消发送-菲菲公主陆绮菲.lrc",
		duration: 0,
	},
	{
		id: 19,
		title: "花海",
		artist: "周杰伦",
		cover: "assets/music/cover/花海-周杰伦.jpg",
		url: "assets/music/url/花海-周杰伦.mp3",
		lrc: "assets/music/lrc/花海-周杰伦.lrc",
		duration: 0,
	},
];

export const DEFAULT_SONG: Song = {
	title: "Sample Song",
	artist: "Sample Artist",
	cover: "/favicon/favicon.ico",
	url: "",
	duration: 0,
	id: 0,
};

export const DEFAULT_METING_API ="https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r";
export const DEFAULT_METING_ID = "14164869977";
export const DEFAULT_METING_SERVER = "netease";
export const DEFAULT_METING_TYPE = "playlist";

export const ERROR_DISPLAY_DURATION = 3000;
export const SKIP_ERROR_DELAY = 1000;
