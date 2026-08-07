<script lang="ts">
import { onDestroy, onMount, tick } from "svelte";
import type { MusicPlayerState } from "@/stores/musicPlayerStore";
import { musicPlayerStore } from "@/stores/musicPlayerStore";

let containerEl: HTMLDivElement;
let trackEl: HTMLDivElement;
let lyricsStatus = $state<"loading" | "loaded" | "none" | "failed">("loading");
let offsetY = $state(0);
let currentLyrics = $state<{ time: number; text: string }[]>([]);
let currentIndex = $state(-1);
let unsubscribe: (() => void) | undefined;

const statusLabels = {
	loading: "正在加载歌词",
	none: "暂无歌词",
	failed: "歌词加载失败",
};

const statusText = $derived(
	lyricsStatus === "failed"
		? statusLabels.failed
		: lyricsStatus === "none"
			? statusLabels.none
			: statusLabels.loading,
);
const hasLyrics = $derived(currentLyrics.length > 0);

function syncFromStore(state: MusicPlayerState) {
	currentLyrics = state.lyrics;
	currentIndex = state.currentLrcIndex;
	if (state.lyrics.length > 0) {
		lyricsStatus = "loaded";
	} else if (state.currentSong?.lrc) {
		lyricsStatus = "loading";
	} else {
		lyricsStatus = "none";
	}
	void queueLyricOffset();
}

function syncLyricOffset() {
	if (!containerEl || !trackEl || currentLyrics.length === 0) {
		offsetY = 0;
		return;
	}

	const nextIndex = currentIndex >= 0 ? currentIndex : 0;
	const activeEl = trackEl.querySelector<HTMLElement>(
		`[data-lyric-index="${nextIndex}"]`,
	);
	if (!activeEl) return;

	const lyricCenter = activeEl.offsetTop + activeEl.offsetHeight / 2;
	const targetCenter =
		containerEl.clientHeight * (currentIndex >= 0 ? 0.5 : 0.58);
	offsetY = targetCenter - lyricCenter;
}

async function queueLyricOffset() {
	await tick();
	syncLyricOffset();
}

onMount(() => {
	unsubscribe = musicPlayerStore.subscribe(syncFromStore);
	void queueLyricOffset();
});

onDestroy(() => {
	unsubscribe?.();
});
</script>

<div bind:this={containerEl} class="music-visualizer__lyrics">
	<div class="music-visualizer__lyrics-stage">
		<div class="music-visualizer__lyrics-timeline"></div>
		{#if hasLyrics}
		<div
			bind:this={trackEl}
			class="music-visualizer__lyrics-inner"
			style={`transform: translateY(${offsetY}px)`}
		>
			{#each currentLyrics as line, i}
				<div
					class="music-visualizer__lyric-line"
					class:music-visualizer__lyric-line--active={i === currentIndex}
					class:music-visualizer__lyric-line--past={i < currentIndex}
					data-lyric-index={i}
				>
					<span class="music-visualizer__lyric-marker"></span>
					<span class="music-visualizer__lyric-text">{line.text}</span>
				</div>
			{/each}
		</div>
		{:else}
			<div class="music-visualizer__lyrics-empty" aria-live="polite">
				<span class="music-visualizer__lyric-marker music-visualizer__lyric-marker--empty"></span>
				<span>{statusText}</span>
			</div>
		{/if}
	</div>
</div>
