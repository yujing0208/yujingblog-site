import type { NavBarConfig } from "../types/config";
import { deepMerge } from "./_settings";
// ↓ 内容仓 content/settings/navbar.ts
import editable from "../settings/navbar";

// ══════════════════════════════════════════════════════════════════════
// 导航菜单配置（薄 Provider）
//
// ⚠️ 这里**不再使用** LinkPreset 数字枚举。
//
// 原写法是 `children: [..., LinkPreset.Anime, LinkPreset.Albums, ...]`，
// 而 LinkPreset 是个纯数字枚举（Anime=4、Albums=6），数组里放进去的其实是数字，
// 运行期再由 LinkPresets[4] 查表还原成 { name, url, icon }。
//
// 那样对人和编辑器都不友好（存进去是 4，改的人根本不知道 4 是什么），
// 所以迁移时已按实际取值展开成字面量对象（见 content/settings/navbar.ts 顶部注释）。
//
// 消费方（NavMenuPanel.astro / PaperHeader.astro / MobileDock2.astro）里
// 那段 `typeof child === "number"` 的分支已随之删除 —— 现在数组里只可能是对象。
// ══════════════════════════════════════════════════════════════════════

export const navBarConfig: NavBarConfig = deepMerge<NavBarConfig>(
	{
		links: [
			{ name: "首页", url: "/", icon: "lucide:house" },
			{ name: "归档", url: "/archive/", icon: "lucide:archive" },
		],
	},
	editable,
);
