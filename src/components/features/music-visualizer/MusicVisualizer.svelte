<script lang="ts">
import { onDestroy, onMount } from "svelte";
import { musicVisualizerConfig } from "@/config/fireflyMusic";
import { musicPlayerStore } from "@/stores/musicPlayerStore";
import { audioAnalyzer } from "./AudioAnalyzer";
import { extractDominantColor } from "./colorExtractor";
import LyricsOverlay from "./LyricsOverlay.svelte";
import ThreeScene from "./ThreeScene.svelte";
import VisualizerControls from "./VisualizerControls.svelte";

let sceneReady = $state(false);
let backgroundColor = $state(
	musicVisualizerConfig.background?.dark ?? "#0a0a15",
);
let accentColor = $state<string | null>(null);
let colorMode = $state<"dynamic" | "theme">("dynamic");
let lastTrackUrl = $state<string>("");
let connectTimer: ReturnType<typeof setTimeout> | null = null;

function syncPageBackground() {
	backgroundColor = document.documentElement.classList.contains("dark")
		? (musicVisualizerConfig.background?.dark ?? "#0a0a15")
		: (musicVisualizerConfig.background?.light ?? "#ffffff");
	const pageEl = document.querySelector(".music-visualizer-page");
	if (pageEl instanceof HTMLElement) {
		pageEl.style.setProperty("--music-page-bg", backgroundColor);
	}
}

function connectAudio() {
	if (connectTimer) {
		clearTimeout(connectTimer);
		connectTimer = null;
	}
	const audio = musicPlayerStore.getAudio();
	if (!audio) {
		connectTimer = setTimeout(connectAudio, 200);
		return;
	}
	if (!audio.crossOrigin) {
		audio.crossOrigin = "anonymous";
	}
	try {
		audioAnalyzer.connect(audio);
	} catch (e) {
		console.warn("[MusicVisualizer] AudioAnalyzer connect failed:", e);
	}

	if (audioCtxState() === "suspended") {
		audioAnalyzer.resume();
	}
}

function audioCtxState() {
	return audioAnalyzer.audioCtx?.state || "running";
}

async function onTrackChange() {
	const track = musicPlayerStore.getCurrentTrack();
	if (colorMode !== "dynamic") return;
	if (track?.cover) {
		const color = await extractDominantColor(track.cover);
		if (color) {
			accentColor = color;
		}
	}
}

function onColorModeChange(e: CustomEvent) {
	colorMode = e.detail.mode;
	if (colorMode === "theme") {
		accentColor = null;
	} else {
		// Re-extract color for current track
		const track = musicPlayerStore.getCurrentTrack();
		if (track?.cover) {
			extractDominantColor(track.cover).then((color) => {
				if (color) accentColor = color;
			});
		}
	}
}

onMount(() => {
	// 音乐页面全屏沉浸：隐藏博客外壳并锁定深色主题（不修改 localStorage）
	const originalDark = document.documentElement.classList.contains("dark");
	const originalDataTheme = document.documentElement.getAttribute("data-theme");
	document.documentElement.classList.add("music-fullscreen");
	document.documentElement.classList.add("dark");

	function blockThemeSwitch() {
		document.documentElement.classList.add("dark");
	}
	window.addEventListener("storage", blockThemeSwitch);
	const fullscreenThemeObserver = new MutationObserver((mutations) => {
		for (const m of mutations) {
			if (
				m.attributeName === "class" &&
				!document.documentElement.classList.contains("dark")
			) {
				document.documentElement.classList.add("dark");
			}
		}
	});
	fullscreenThemeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	syncPageBackground();

	// Initialize color mode from localStorage
	const savedColorMode = localStorage.getItem("music-color-mode");
	if (savedColorMode === "theme" || savedColorMode === "dynamic") {
		colorMode = savedColorMode;
		if (colorMode === "theme") accentColor = null;
	}

	const themeObserver = new MutationObserver(syncPageBackground);
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	// Ensure global store is initialized and connect analyzer to its audio element
	void musicPlayerStore.initialize();
	connectAudio();

	const unsubscribeStore = musicPlayerStore.subscribe((state) => {
		// 歌曲切换时动态提取封面主题色
		if (state.currentSong.url && state.currentSong.url !== lastTrackUrl) {
			lastTrackUrl = state.currentSong.url;
			void onTrackChange();
		}
	});

	const handleFirstClick = () => {
		audioAnalyzer.resume();
		document.removeEventListener("click", handleFirstClick);
	};
	document.addEventListener("click", handleFirstClick);

	window.addEventListener(
		"fm:color-mode-changed",
		onColorModeChange as EventListener,
	);

	// 导航栏自动隐藏：初始显示3秒后渐隐，鼠标移到顶部区域渐显
	const navbar = document.querySelector(".music-navbar");
	let hideTimer: ReturnType<typeof setTimeout>;
	let hidden = false;
	const TRIGGER_ZONE = 80;

	function showNavbar() {
		clearTimeout(hideTimer);
		if (hidden) {
			navbar?.classList.remove("navbar-hidden");
			hidden = false;
		}
	}

	function startHideTimer() {
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			if (!hidden) {
				navbar?.classList.add("navbar-hidden");
				hidden = true;
			}
		}, 600);
	}

	function onMouseMove(e: MouseEvent) {
		if (e.clientY < TRIGGER_ZONE) {
			showNavbar();
		} else if (!hidden) {
			startHideTimer();
		}
	}

	if (navbar) {
		hideTimer = setTimeout(() => {
			navbar.classList.add("navbar-hidden");
			hidden = true;
		}, 3000);

		document.addEventListener("mousemove", onMouseMove, { passive: true });
	}

	return () => {
		unsubscribeStore();
		if (connectTimer) {
			clearTimeout(connectTimer);
			connectTimer = null;
		}
		themeObserver.disconnect();
		fullscreenThemeObserver.disconnect();
		window.removeEventListener("storage", blockThemeSwitch);
		document.documentElement.classList.remove("music-fullscreen");
		if (!originalDark) document.documentElement.classList.remove("dark");
		if (originalDataTheme)
			document.documentElement.setAttribute("data-theme", originalDataTheme);
		document.removeEventListener("click", handleFirstClick);
		window.removeEventListener(
			"fm:color-mode-changed",
			onColorModeChange as EventListener,
		);
		clearTimeout(hideTimer);
		document.removeEventListener("mousemove", onMouseMove);
	};
});

onDestroy(() => {
	// 离开音乐可视化页面时只清理页面级资源，绝不暂停底层音频播放
	audioAnalyzer.disconnect();
});
</script>

<div class="music-visualizer" style={`background: ${backgroundColor};`}>
	<div
		class="mv-three-stage"
		class:mv-three-stage--ready={sceneReady}
	>
		<ThreeScene
			{audioAnalyzer}
			{backgroundColor}
			{accentColor}
			onSceneReady={() => (sceneReady = true)}
		/>
	</div>

	<nav class="music-navbar">
		<a href="/" class="music-navbar-title" title="返回首页">YuJingMusic</a>
		<div class="music-navbar-links">
			<a href="/" class="music-navbar-link" data-swup-ignore>首页</a>
			<a href="/archive/" class="music-navbar-link" data-swup-ignore>归档</a>
			<a href="/about/" class="music-navbar-link" data-swup-ignore>关于</a>
			<a href="/friends/" class="music-navbar-link" data-swup-ignore>友链</a>
			<a href="/music/" class="music-navbar-link active" data-swup-ignore>音乐</a>
		</div>
	</nav>

	<LyricsOverlay />

	<VisualizerControls />
</div>
