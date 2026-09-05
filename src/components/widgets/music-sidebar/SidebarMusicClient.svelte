<script lang="ts">
import Icon from "@iconify/svelte";
import { onDestroy, onMount } from "svelte";

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
	<div class="music-sidebar-header">
		<SidebarCover
			currentSong={playerState.currentSong}
			isPlaying={playerState.isPlaying}
			isLoading={playerState.isLoading}
			size="mini"
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
		<a
			class="sidebar-music-jump"
			href="/music/"
			title="打开 3D 音乐可视化"
			aria-label="打开 3D 音乐可视化"
			data-swup-ignore
		>
			<Icon icon="material-symbols:view-in-ar" class="text-lg" />
		</a>
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

	<SidebarPlaylist
		playlist={playerState.playlist}
		currentIndex={playerState.currentIndex}
		isPlaying={playerState.isPlaying}
		show={showPlaylist}
		onClose={togglePlaylistView}
		onPlaySong={playIndex}
	/>
</div>

<style>
	.music-sidebar-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.sidebar-music-jump {
		margin-left: auto;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 0.6rem;
		color: var(--content-meta);
		transition:
			color 0.2s ease,
			background-color 0.2s ease;
	}

	.sidebar-music-jump:hover {
		color: var(--primary);
		background-color: color-mix(in srgb, var(--primary) 8%, transparent);
	}

	@media (width < 520px) {
		.music-sidebar-widget {
			min-width: 0;
		}

		.music-sidebar-header {
			gap: 0.65rem;
			margin-bottom: 0.6rem;
		}
	}
</style>
