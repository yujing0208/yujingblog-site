import type { ProfileConfig } from "../types/config";
import { deepMerge } from "./_settings";
// ↓ 内容仓 content/settings/profile.ts
import editable from "../settings/profile";

// ══════════════════════════════════════════════════════════════════════
// 个人资料配置（薄 Provider）
//
// 侧边栏名片、首屏社交链接都读这里。
// links 是可增删的对象数组 —— 数据在内容仓，编辑器里做成可拖动排序的行编辑器。
// ══════════════════════════════════════════════════════════════════════

export const profileConfig: ProfileConfig = deepMerge<ProfileConfig>(
	{
		avatar: "/assets/home/avatar.webp",
		name: "YuJing",
		bio: "",
		typewriter: { enable: true, speed: 80 },
		links: [],
	},
	editable,
);
