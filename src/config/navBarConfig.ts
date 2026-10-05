import type { NavBarConfig } from "../types/config";
import { deepMerge } from "./_settings";
// ↓ 内容仓 content/settings/navbar.ts
import editable from "../settings/navbar";

// ══════════════════════════════════════════════════════════════════════
// 导航菜单配置（薄 Provider）
//
// 数据在内容仓 content/settings/navbar.ts，导航项是**纯字面量对象**：
//   { name, url, icon, external?, children? }
//
// 历史上这里用过 LinkPreset 数字枚举（`children: [..., LinkPreset.Anime, 4]`），
// 运行期再由 `LinkPresets[4]` 查表还原 —— 存进去是 4，改的人不知道 4 是什么。
// 2026-10-03 迁移到内容仓时已按实际取值**展开成字面量**，于是：
//   · LinkPreset 枚举 / LinkPresets 查表 / 三处 `typeof === "number"` 分支 全部删除
//   · NavBarLink 的 children 类型收敛为 NavBarLink[]
// 渲染结果与改造前逐字节一致（追番=/anime/ + lucide:clapperboard，相册=/albums/ + lucide:images）。
// ══════════════════════════════════════════════════════════════════════

export const navBarConfig: NavBarConfig = deepMerge<NavBarConfig>(
	{
		links: [
			{ name: "首页", url: "/", icon: "lucide:house" },
			{ name: "归档", url: "/archive/", icon: "lucide:archive" },
		],
		// 顶栏品牌区「找到我」下拉：独立于 profileConfig.links（社交链接）。
		// 这里是内容仓缺字段时的回落值，正常以 content/settings/navbar.ts 为准。
		brandMenu: [{ name: "编辑器", url: "/admin", icon: "lucide:pen-line" }],
	},
	editable,
);
