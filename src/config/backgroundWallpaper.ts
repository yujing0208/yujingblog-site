import type { FullscreenWallpaperConfig } from "../types/config";
import { deepMerge } from "./_settings";
// ↓ 内容仓 content/settings/wallpaper.ts
import editable from "../settings/wallpaper";

// ══════════════════════════════════════════════════════════════════════
// 全屏壁纸配置（薄 Provider）
//
// ⚠️ 当前 siteConfig.wallpaperMode.defaultMode 是 "none"，也就是说壁纸模式没启用，
//    这个对象的值暂时不会体现在页面上。留着是因为它是一份完整的、可随时切回去的配置。
//
// 形状转换：内容仓里的 wallpaper.ts 把原三层嵌套的
//   overlay.switchable / fullscreen.switchable
// 拍平成了顶层 overlaySwitchable / fullscreenSwitchable（对编辑器友好）。
// 而 SiteConfig 类型要的是嵌套形态，所以在这里还原回去。
// ══════════════════════════════════════════════════════════════════════

type FlatWallpaper = {
	enable?: boolean;
	desktop?: string[];
	mobile?: string[];
	position?: "top" | "center" | "bottom";
	carousel?: { enable: boolean; interval: number };
	zIndex?: number;
	opacity?: number;
	blur?: number;
	switchable?: boolean;
	overlay?: { opacity?: number; cardOpacity?: number };
	overlaySwitchable?: { opacity?: boolean; blur?: boolean; cardOpacity?: boolean };
	fullscreenSwitchable?: { opacity?: boolean; blur?: boolean };
};

/** 把内容仓的扁平形状还原成 SiteConfig 期望的嵌套形状 */
function unflatten(w: FlatWallpaper): FullscreenWallpaperConfig {
	return {
		enable: w.enable,
		src: { desktop: w.desktop ?? [], mobile: w.mobile ?? [] },
		position: w.position,
		carousel: w.carousel,
		zIndex: w.zIndex,
		opacity: w.opacity,
		blur: w.blur,
		switchable: w.switchable,
		overlay: {
			opacity: w.overlay?.opacity,
			blur: w.blur,
			cardOpacity: w.overlay?.cardOpacity,
			switchable: w.overlaySwitchable,
		},
		fullscreen: {
			switchable: w.fullscreenSwitchable,
		},
	};
}

export const fullscreenWallpaperConfig: FullscreenWallpaperConfig = unflatten(
	deepMerge<FlatWallpaper>(
		{
			enable: false,
			desktop: [],
			mobile: [],
			position: "center",
			carousel: { enable: false, interval: 5 },
			zIndex: -1,
			opacity: 0.8,
			blur: 1,
			switchable: true,
			overlay: { opacity: 0.8, cardOpacity: 0.8 },
			overlaySwitchable: { opacity: true, blur: true, cardOpacity: true },
			fullscreenSwitchable: { opacity: true, blur: true },
		},
		editable,
	),
);
