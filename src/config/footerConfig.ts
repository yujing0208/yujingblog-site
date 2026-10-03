import type { FooterConfig } from "../types/config";
import { deepMerge } from "./_settings";
// ↓ 内容仓 content/settings/footer.ts
import editable from "../settings/footer";

// ══════════════════════════════════════════════════════════════════════
// 页脚配置（薄 Provider）
//
// 目前 enable=false（用主题自带的页脚）。
// 打开后可以把自定义 HTML（备案号之类）注入页脚。
// ══════════════════════════════════════════════════════════════════════

export const footerConfig: FooterConfig = deepMerge<FooterConfig>(
	{
		enable: false,
		customHtml: "",
	},
	editable,
);
