<script lang="ts">
import { DARK_MODE, DEFAULT_THEME, LIGHT_MODE } from "@constants/constants";
import Icon from "@iconify/svelte";
import { getStoredTheme, setTheme } from "@utils/setting-utils";
import { onMount } from "svelte";

import type { LIGHT_DARK_MODE } from "@/types/config.ts";

const seq: LIGHT_DARK_MODE[] = [LIGHT_MODE, DARK_MODE];
let mode: LIGHT_DARK_MODE = $state(DEFAULT_THEME);
let isChanging = false;

onMount(() => {
	mode = getStoredTheme();

	// 2026-10-06：移除 swup 后站点回到浏览器原生整页刷新，
	// 不再有「同一文档内替换内容」的时刻，原 content:replace / swup:enable
	// 钩子已无触发可能。主题在每次整页加载时由 head 内联脚本从 localStorage
	// 重新初始化，这里的 onMount 读值即为权威状态，无需再做跨页同步。
});

function switchScheme(newMode: LIGHT_DARK_MODE) {
	// 防止连续快速点击
	if (isChanging) {
		return;
	}

	isChanging = true;
	mode = newMode;
	setTheme(newMode);

	// 50ms 后重置状态，防止过快切换
	setTimeout(() => {
		isChanging = false;
	}, 50);
}

function toggleScheme() {
	if (isChanging) {
		return;
	}

	let i = 0;
	for (; i < seq.length; i++) {
		if (seq[i] === mode) {
			break;
		}
	}
	switchScheme(seq[(i + 1) % seq.length]);
}
</script>

<button
	aria-label="Light/Dark Mode"
	class="relative btn-plain scale-animation rounded-lg h-11 w-11 active:scale-90 theme-switch-btn z-50"
	id="scheme-switch"
	onclick={toggleScheme}
	data-mode={mode}
>
	<div
		class="absolute transition-all duration-300 ease-in-out"
		class:opacity-0={mode !== LIGHT_MODE}
		class:rotate-180={mode !== LIGHT_MODE}
	>
		<Icon
			icon="lucide:sun"
			class="text-[1.25rem]"
		></Icon>
	</div>
	<div
		class="absolute transition-all duration-300 ease-in-out"
		class:opacity-0={mode !== DARK_MODE}
		class:rotate-180={mode !== DARK_MODE}
	>
		<Icon
			icon="lucide:moon"
			class="text-[1.25rem]"
		></Icon>
	</div>
</button>

<style>
	/* 确保主题切换按钮的背景色即时更新 */
	.theme-switch-btn::before {
		transition:
			transform 75ms ease-out,
			background-color 0ms !important;
	}
</style>
