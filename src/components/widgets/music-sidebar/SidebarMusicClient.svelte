<script lang="ts">
import { onDestroy, onMount } from "svelte";
import Icon from "@iconify/svelte";

import type { MusicPlayerState } from "@/stores/musicPlayerStore";
import { musicPlayerStore } from "@/stores/musicPlayerStore";

import SidebarControls from "./components/SidebarControls.svelte";
import SidebarCover from "./components/SidebarCover.svelte";
import SidebarPlaylist from "./components/SidebarPlaylist.svelte";
import SidebarProgress from "./components/SidebarProgress.svelte";
import SidebarTrackInfo from "./components/SidebarTrackInfo.svelte";

let playerState: MusicPlayerState = $state(musicPlayerStore.getState());
let showPlaylist = $state(false);

function handleStateUpdate(event: Event) {
	const custom = event as CustomEvent<MusicPlayerState>;
	if (custom.detail) {
		playerState = custom.detail;
	}
}

onMount(() => {
	window.addEventListener("music-sidebar:state", handleStateUpdate);
});

onDestroy(() => {
	if (typeof window !== "undefined") {
		window.removeEventListener("music-sidebar:state", handleStateUpdate);
	}
});

function togglePlay() {
	musicPlayerStore.toggle();
}

function prev() {
	musicPlayerStore.prev();
}

function next() {
	musicPlayerStore.next();
}

function toggleMode() {
	musicPlayerStore.toggleMode();
}

function setMode(mode: import("../music-player/types").PlayerMode) {
	musicPlayerStore.setMode(mode);
}

function togglePlaylistView() {
	showPlaylist = !showPlaylist;
}

function playIndex(index: number) {
	musicPlayerStore.playIndex(index);
}

function seek(time: number) {
	musicPlayerStore.seek(time);
}

function toggleMute() {
	musicPlayerStore.toggleMute();
}

function setVolume(volume: number) {
	musicPlayerStore.setVolume(volume);
}
</script>

<div class="music-sidebar-widget">
	<div class="flex items-center gap-3 mb-2.5">
		<SidebarCover
			currentSong={playerState.currentSong}
			isPlaying={playerState.isPlaying}
			isLoading={playerState.isLoading}
		/>
		<SidebarTrackInfo
			currentSong={playerState.currentSong}
			currentTime={playerState.currentTime}
			duration={playerState.duration}
			volume={playerState.volume}
			isMuted={playerState.isMuted}
			onToggleMute={toggleMute}
			onSetVolume={setVolume}
		/>
	</div>

	<SidebarProgress
		currentTime={playerState.currentTime}
		duration={playerState.duration}
		onSeek={seek}
	/>

	<SidebarControls
		isPlaying={playerState.isPlaying}
		isShuffled={playerState.isShuffled}
		repeatMode={playerState.isRepeating}
		onToggleMode={toggleMode}
		onPrev={prev}
		onNext={next}
		onTogglePlay={togglePlay}
		onTogglePlaylist={togglePlaylistView}
	/>

	<a
		class="sidebar-music-jump"
		href="/music"
		title="进入 3D 音乐可视化"
		aria-label="进入 3D 音乐可视化"
		data-swup-ignore
	>
		<Icon icon="material-symbols:cube-rounded" class="text-lg" />
		<span>3D 音乐可视化</span>
		<Icon icon="material-symbols:arrow-outward-rounded" class="text-base" />
	</a>

	<SidebarPlaylist
		playlist={playerState.playlist}
		currentIndex={playerState.currentIndex}
		isPlaying={playerState.isPlaying}
		show={showPlaylist}
		mode={playerState.mode}
		onClose={togglePlaylistView}
		onPlaySong={playIndex}
		onModeChange={setMode}
	/>
</div>

<style>
	.sidebar-music-jump {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		margin-top: 0.65rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.7rem;
		border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
		background: color-mix(in srgb, var(--primary) 10%, transparent);
		color: var(--primary);
		font-size: 0.82rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 0.2s ease,
			transform 0.15s ease;
	}

	.sidebar-music-jump:hover {
		background: color-mix(in srgb, var(--primary) 18%, transparent);
	}

	.sidebar-music-jump:active {
		transform: scale(0.98);
	}

	@media (width < 520px) {
		.music-sidebar-widget {
			min-width: 0;
		}

		.music-sidebar-widget > :global(div:first-child) {
			gap: 0.75rem;
			margin-bottom: 0.5rem;
		}
	}
</style>
