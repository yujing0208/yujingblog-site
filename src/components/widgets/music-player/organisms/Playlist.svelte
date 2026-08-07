<script lang="ts">
import Icon from "@iconify/svelte";
import { slide } from "svelte/transition";

import Key from "../../../../i18n/i18nKey";
import { i18n } from "../../../../i18n/translation";
import type { PlayerMode, Song } from "../types";

import ModeToggle from "../molecules/ModeToggle.svelte";
import PlaylistItem from "../atoms/PlaylistItem.svelte";

interface Props {
	playlist: Song[];
	currentIndex: number;
	isPlaying: boolean;
	show: boolean;
	mode: PlayerMode;
	onClose: () => void;
	onPlaySong: (index: number) => void;
	onModeChange: (mode: PlayerMode) => void;
}

const {
	playlist,
	currentIndex,
	isPlaying,
	show,
	mode,
	onClose,
	onPlaySong,
	onModeChange,
}: Props = $props();
</script>

{#if show}
	<div
		class="playlist-panel card-base-transparent fixed bottom-70 right-4 w-80 max-h-96 overflow-hidden z-50"
		transition:slide={{ duration: 300, axis: "y" }}
	>
		<div
			class="playlist-header flex items-center justify-between p-4 border-b border-(--line-divider)"
		>
			<h3 class="text-lg font-semibold text-90">
				{i18n(Key.musicPlayerPlaylist)}
			</h3>
			<button class="btn-plain w-8 h-8 rounded-lg" onclick={onClose}>
				<Icon icon="material-symbols:close" class="text-lg" />
			</button>
		</div>
		<div class="playlist-mode-bar">
			<ModeToggle {mode} onChange={onModeChange} />
		</div>
		<div
			class="playlist-content overflow-y-auto max-h-80 hide-scrollbar"
			role="presentation"
		>
			{#each playlist as song, index}
				<PlaylistItem
					{song}
					{index}
					isCurrent={index === currentIndex}
					{isPlaying}
					onclick={() => onPlaySong(index)}
					lazy={index !== 0}
				/>
			{/each}
		</div>
	</div>
{/if}

<style>
	.playlist-panel {
		right: var(--fab-group-right, 1.5rem);
		bottom: calc(
			var(--fab-group-bottom, 10rem) +
				(var(--fab-button-size, 3rem) * var(--fab-visible-count, 1)) +
				(
					var(--fab-group-gap, 0.5rem) *
						(var(--fab-visible-count, 1) - 1)
				) +
				6.75rem
		);
	}

	.playlist-mode-bar {
		display: flex;
		justify-content: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, var(--line-divider) 50%, transparent);
	}

	@media (width < 768px) {
		.playlist-panel {
			width: 280px !important;
			max-width: 280px !important;
			right: var(--fab-group-right, 0.75rem) !important;
		}
	}

	@media (width < 480px) {
		.playlist-panel {
			width: 260px !important;
			max-width: 260px !important;
			right: var(--fab-group-right, 0.5rem) !important;
		}
	}
</style>
