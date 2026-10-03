import type { LicenseConfig } from "../types/config";
import { deepMerge } from "./_settings";
// ↓ 内容仓 content/settings/license.ts
import editable from "../settings/license";

// ══════════════════════════════════════════════════════════════════════
// 文章许可协议配置（薄 Provider）
//
// 文章自己的 frontmatter 没写 licenseName / licenseUrl 时，用这里的值兜底。
// ══════════════════════════════════════════════════════════════════════

export const licenseConfig: LicenseConfig = deepMerge<LicenseConfig>(
	{
		enable: true,
		name: "Unlicensed",
		url: "",
	},
	editable,
);
