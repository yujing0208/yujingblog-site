<script lang="ts">
import Icon from "./Icon.svelte";
import { onDestroy, onMount } from "svelte";
import type { MusicPlayerState } from "@/stores/musicPlayerStore";
import { musicPlayerStore } from "@/stores/musicPlayerStore";
import type { PlayerMode, Song } from "@/components/widgets/music-player/types";
import ModeToggle from "@/components/widgets/music-player/molecules/ModeToggle.svelte";

interface Track {
	name: string;
	artist: string;
	pic?: string;
}

function songToTrack(song: Song | null): Track | null {
	if (!song) return null;
	return {
		name: song.title,
		artist: song.artist,
		pic: song.cover,
	};
}

function playlistToTracks(songs: Song[]): Track[] {
	return songs.map((song) => ({
		name: song.title,
		artist: song.artist,
		pic: song.cover,
	}));
}

function formatTime(seconds: number): string {
	if (!seconds || Number.isNaN(seconds)) return "0:00";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

let playerState: MusicPlayerState = $state(musicPlayerStore.getState());
let currentTrack: Track | null = $state(songToTrack(playerState.currentSong));
let playlist: Track[] = $state(playlistToTracks(playerState.playlist));
let currentIndex = $state(playerState.currentIndex);
let isPlaying = $state(playerState.isPlaying);
let volume = $state(playerState.volume);
let isMuted = $state(playerState.isMuted);
let playMode = $state(playerState.isRepeating);
let currentTimeStr = $state("0:00");
let durationStr = $state("0:00");
let progress = $state(0);
let isPlaylistOpen = $state(true);
let isMobile = $state(false);
let playlistListEl: HTMLDivElement;
let showSwitchDialog = $state(false);
let switchPlaylistId = $state("");
let isSwitching = $state(false);
let colorMode = $state<"dynamic" | "theme">("dynamic");
let unsubscribe: (() => void) | undefined;

function syncFromStore(state: MusicPlayerState) {
	playerState = state;
	currentTrack = songToTrack(state.currentSong);
	playlist = playlistToTracks(state.playlist);
	currentIndex = state.currentIndex;
	isPlaying = state.isPlaying;
	volume = state.volume;
	isMuted = state.isMuted;
	playMode = state.isRepeating;
	currentTimeStr = formatTime(state.currentTime);
	durationStr = formatTime(state.duration);
	progress = state.duration ? (state.currentTime / state.duration) * 100 : 0;
	setTimeout(syncPlaylistScroll, 0);
}

function toggleColorMode() {
	colorMode = colorMode === "dynamic" ? "theme" : "dynamic";
	localStorage.setItem("music-color-mode", colorMode);
	window.dispatchEvent(
		new CustomEvent("fm:color-mode-changed", { detail: { mode: colorMode } }),
	);
}

function syncPlaylistScroll() {
	if (!playlistListEl) return;
	const activeItem = playlistListEl.querySelector<HTMLElement>(
		".music-visualizer__playlist-item--active",
	);
	activeItem?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function togglePlay() {
	musicPlayerStore.toggle();
}

function playNext() {
	musicPlayerStore.next();
}

function playPrev() {
	musicPlayerStore.prev();
}

function cycleMode() {
	musicPlayerStore.toggleMode();
}

function toggleMute() {
	musicPlayerStore.toggleMute();
}

function onVolumeClick(e: MouseEvent) {
	const target = e.currentTarget as HTMLElement;
	const rect = target.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const val = Math.max(0, Math.min(1, x / rect.width));
	musicPlayerStore.setVolume(val);
}

function onProgressClick(e: MouseEvent) {
	const target = e.currentTarget as HTMLElement;
	const rect = target.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const percent = Math.max(0, Math.min(1, x / rect.width));
	musicPlayerStore.setProgress(percent);
}

function playTrack(index: number) {
	musicPlayerStore.playIndex(index);
	// 歌单常驻：点击曲目后保持展开
}

function togglePlaylist() {
	isPlaylistOpen = !isPlaylistOpen;
}

function closePlaylist() {
	isPlaylistOpen = false;
}

	function openSwitchDialog() {
		showSwitchDialog = true;
	}

function closeSwitchDialog() {
	showSwitchDialog = false;
	switchPlaylistId = "";
}

async function handleSwitchPlaylist() {
	const id = switchPlaylistId.trim();
	if (!id) return;
	isSwitching = true;
	try {
		await musicPlayerStore.switchCloudPlaylist(id);
		closeSwitchDialog();
	} catch (e) {
		console.warn("[VisualizerControls] switchCloudPlaylist failed:", e);
	} finally {
		isSwitching = false;
	}
}

function onSwitchKeydown(e: KeyboardEvent) {
	if (e.key === "Enter") {
		handleSwitchPlaylist();
	} else if (e.key === "Escape") {
		closeSwitchDialog();
	}
}

async function handleResetPlaylist() {
	isSwitching = true;
	try {
		await musicPlayerStore.resetCloudPlaylist();
		closeSwitchDialog();
	} catch (e) {
		console.warn("[VisualizerControls] resetCloudPlaylist failed:", e);
	} finally {
		isSwitching = false;
	}
}

function handleModeChange(mode: PlayerMode) {
	musicPlayerStore.setMode(mode);
}

onMount(() => {
	void musicPlayerStore.initialize();
	unsubscribe = musicPlayerStore.subscribe(syncFromStore);
	setTimeout(() => syncFromStore(musicPlayerStore.getState()), 100);

	isMobile = window.innerWidth < 769;
	// 歌单设为常驻：桌面与移动端均默认展开，不自动收起

	const savedColorMode = localStorage.getItem("music-color-mode");
	if (savedColorMode === "theme" || savedColorMode === "dynamic") {
		colorMode = savedColorMode;
	}
});

onDestroy(() => {
	unsubscribe?.();
});
</script>

<div class="music-controls-bar">
	<div class="music-controls-progress-row">
		<span class="music-controls-time">{currentTimeStr}</span>
		<div
			class="music-controls-progress"
			onclick={onProgressClick}
			role="slider"
			aria-label="进度"
		>
			<div
				class="music-controls-progress-fill"
				style={`width: ${progress}%`}
			/>
		</div>
		<span class="music-controls-time">{durationStr}</span>
	</div>

	<div class="music-controls-row">
		<div class="music-controls-left">
			<div class="music-controls-cover">
				{#if currentTrack?.pic}
					<img src={currentTrack.pic} alt="" />
				{:else}
					<Icon icon="material-symbols:music-note-rounded" size="lg" />
				{/if}
			</div>
			<div class="music-controls-track-info">
				<div class="music-controls-track-name">
					{currentTrack?.name || "未播放"}
				</div>
				<div class="music-controls-track-artist">
					{currentTrack?.artist || ""}
				</div>
			</div>
		</div>

		<div class="music-controls-center">
			<button
				class="music-controls-btn"
				onclick={playPrev}
				title="上一首"
				aria-label="上一首"
			>
				<Icon icon="material-symbols:skip-previous-rounded" size="2xl" />
			</button>

			<button
				class="music-controls-btn music-controls-btn--play"
				onclick={togglePlay}
				title={isPlaying ? "暂停" : "播放"}
				aria-label={isPlaying ? "暂停" : "播放"}
			>
				{#if isPlaying}
					<Icon icon="material-symbols:pause-rounded" size="2xl" />
				{:else}
					<Icon icon="material-symbols:play-arrow-rounded" size="2xl" />
				{/if}
			</button>

			<button
				class="music-controls-btn"
				onclick={playNext}
				title="下一首"
				aria-label="下一首"
			>
				<Icon icon="material-symbols:skip-next-rounded" size="2xl" />
			</button>

			<button
				class="music-controls-btn"
				onclick={cycleMode}
				title="播放模式"
				aria-label="播放模式"
			>
				{#if playerState.isShuffled}
					<Icon icon="material-symbols:shuffle-rounded" size="lg" />
				{:else if playMode === 1}
					<Icon icon="material-symbols:repeat-one-rounded" size="lg" />
				{:else}
					<Icon icon="material-symbols:repeat-rounded" size="lg" />
				{/if}
			</button>
		</div>

		<div class="music-controls-right">
			<button
				class="music-controls-btn"
				onclick={toggleColorMode}
				title={colorMode === "dynamic" ? "跟随封面取色" : "使用主题色"}
				aria-label={colorMode === "dynamic" ? "当前：跟随封面取色，点击切换为主题色" : "当前：使用主题色，点击切换为跟随封面取色"}
			>
				{#if colorMode === "dynamic"}
					<Icon icon="material-symbols:colorize-rounded" size="lg" />
				{:else}
					<Icon icon="material-symbols:palette" size="lg" />
				{/if}
			</button>

			<button
				class="music-controls-btn"
				onclick={openSwitchDialog}
				title="切换歌单"
				aria-label="切换歌单"
			>
				<Icon icon="material-symbols:playlist-play-rounded" size="lg" />
			</button>

			<button
				class="music-controls-btn"
				class:music-controls-btn--active={isPlaylistOpen}
				onclick={togglePlaylist}
				title={isPlaylistOpen ? "关闭歌单" : "打开歌单"}
				aria-label={isPlaylistOpen ? "关闭歌单" : "打开歌单"}
			>
				<Icon icon="material-symbols:queue-music-rounded" size="lg" />
			</button>

			<div class="music-controls-volume">
				<button
					class="music-controls-btn"
					onclick={toggleMute}
					title="音量"
					aria-label="音量"
				>
					{#if isMuted || volume === 0}
						<Icon icon="material-symbols:volume-off-rounded" size="lg" />
					{:else}
						<Icon icon="material-symbols:volume-up-rounded" size="lg" />
					{/if}
				</button>
				<div
					class="music-controls-volume-bar"
					onclick={onVolumeClick}
				>
					<div
						class="music-controls-volume-fill"
						style={`width: ${isMuted ? 0 : volume * 100}%`}
					/>
				</div>
			</div>
		</div>
	</div>
</div>

<aside
	id="music-visualizer-playlist-panel"
	class="music-visualizer__playlist-panel"
	class:music-visualizer__playlist-panel--open={isPlaylistOpen}
	aria-label="歌单切换"
	aria-hidden={!isPlaylistOpen}
>
	<div class="music-visualizer__playlist-stage">
		<div class="music-visualizer__playlist-timeline"></div>
		<div class="music-visualizer__playlist-header">
			<div>
				<div class="music-visualizer__playlist-kicker">PLAYLIST</div>
				<div class="music-visualizer__playlist-title">歌单切换</div>
			</div>
			<div class="music-visualizer__playlist-count">{playlist.length}</div>
		</div>

		<div
			bind:this={playlistListEl}
			class="music-visualizer__playlist-list"
			role="listbox"
			aria-label="当前歌单"
		>
			{#if playlist.length === 0}
				<div class="music-visualizer__playlist-empty">歌单加载中</div>
			{:else}
				{#each playlist as track, i}
					<button
						type="button"
						class="music-visualizer__playlist-item"
						class:music-visualizer__playlist-item--active={i === currentIndex}
						onclick={() => playTrack(i)}
						role="option"
						aria-selected={i === currentIndex}
						title={`${track.name} - ${track.artist}`}
					>
						<div class="music-visualizer__playlist-cover">
							{#if track.pic}
								<img src={track.pic} alt="" loading="lazy" />
							{:else}
								<Icon icon="material-symbols:music-note-rounded" size="sm" />
							{/if}
						</div>
						<div class="music-visualizer__playlist-meta">
							<div class="music-visualizer__playlist-name">{track.name}</div>
							<div class="music-visualizer__playlist-artist">{track.artist}</div>
						</div>
						{#if i === currentIndex}
							<div class="music-visualizer__playlist-eq" aria-hidden="true">
								<span></span>
								<span></span>
								<span></span>
							</div>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	</div>
</aside>

{#if showSwitchDialog}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="music-switch-overlay"
		onclick={closeSwitchDialog}
		onkeydown={(e) => e.key === "Escape" && closeSwitchDialog()}
		role="dialog"
		aria-modal="true"
		aria-label="切换歌单"
	>
		<div
			class="music-switch-dialog"
			onclick={(e) => e.stopPropagation()}
			onkeydown={onSwitchKeydown}
		>
			<div class="music-switch-header">
				<span class="music-switch-title">切换歌单</span>
				<button
					class="music-switch-close"
					onclick={closeSwitchDialog}
					aria-label="关闭"
				>
					<Icon icon="material-symbols:close-rounded" size="lg" />
				</button>
			</div>
			<div class="music-switch-mode-bar">
				<ModeToggle
					mode={playerState.mode}
					onChange={handleModeChange}
				/>
			</div>
			<div class="music-switch-body">
				<label class="music-switch-label" for="playlist-id-input">
					输入歌单ID
				</label>
				<input
					id="playlist-id-input"
					class="music-switch-input"
					type="text"
					bind:value={switchPlaylistId}
					placeholder="例如: 1234567890"
					onkeydown={onSwitchKeydown}
					disabled={isSwitching}
				/>
				<button
					class="music-switch-submit"
					onclick={handleSwitchPlaylist}
					disabled={isSwitching || !switchPlaylistId.trim()}
				>
					{isSwitching ? "切换中..." : "确认切换"}
				</button>
				<button
					class="music-switch-reset"
					onclick={handleResetPlaylist}
					disabled={isSwitching}
				>
					重置为默认歌单
				</button>
			</div>
		</div>
	</div>
{/if}
