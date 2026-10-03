import type { MusicPlayerConfig } from "../types/config";
import { deepMerge } from "./_settings";
// ↓ 内容仓 content/settings/music.ts
import editable from "../settings/music";

// ══════════════════════════════════════════════════════════════════════
// 音乐播放器配置（薄 Provider）
//
// 走 Meting API 取歌单。换歌单只要改 playlistId；换平台改 server。
//
// 形状说明：SiteConfig 类型里的字段名是 meting_api / id / type，
// 而内容仓用的是更可读的 metingApi / playlistId / playlistType
// （编辑器里显示 "歌单 ID" 比显示 "id" 有用得多）。这里做一次改名映射。
// ══════════════════════════════════════════════════════════════════════

type FlatMusic = {
	enable?: boolean;
	showFloatingPlayer?: boolean;
	floatingEntryMode?: "fab" | "default";
	metingApi?: string;
	playlistId?: string;
	server?: string;
	playlistType?: string;
};

const flat = deepMerge<FlatMusic>(
	{
		enable: false,
		showFloatingPlayer: true,
		floatingEntryMode: "fab",
		metingApi: "",
		playlistId: "",
		server: "netease",
		playlistType: "playlist",
	},
	editable,
);

export const musicPlayerConfig: MusicPlayerConfig = {
	enable: flat.enable ?? false,
	showFloatingPlayer: flat.showFloatingPlayer ?? true,
	floatingEntryMode: flat.floatingEntryMode ?? "fab",
	meting_api: flat.metingApi ?? "",
	id: flat.playlistId ?? "",
	server: flat.server ?? "netease",
	type: flat.playlistType ?? "playlist",
};
