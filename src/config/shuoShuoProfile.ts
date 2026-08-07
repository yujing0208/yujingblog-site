// 说说（朋友圈风格）页面个人资料配置
//
// ⚠️ 重要：本文件位于 src/config 下，不参与内容仓库（yujingblog-content）同步，
// 因此在这里修改「头像 / 昵称 / 签名 / 封面」后 git push 即可在线上生效，
// 不会被内容同步脚本覆盖。日记数据本身仍在 src/data/diary.ts（由内容仓库管理）。

export interface ShuoShuoProfile {
	avatar: string; // 头像 URL
	nickname: string; // 昵称
	bio: string; // 个性签名
	coverImage: string; // 背景封面图（视频加载前 / 不支持时的兜底帧）
	coverVideo?: string; // 背景封面视频（可选，设置后优先于封面图自动循环播放）
}

export const shuoShuoProfile: ShuoShuoProfile = {
	avatar: "/assets/home/avatar.webp",
	nickname: "YuJing",
	bio: "不怪天气不好，是我心事太多",
	coverImage: "/assets/banner/city-sunset.jpg",
	coverVideo: "/assets/shuoshuo-cover.mp4",
};
