<script lang="ts">
import CoverImage from "../../music-player/atoms/CoverImage.svelte";
import type { Song } from "../../music-player/types";

interface Props {
	currentSong: Song;
	isPlaying: boolean;
	isLoading: boolean;
	size?: "mini" | "expanded";
}

const {
	currentSong,
	isPlaying,
	isLoading,
	size = "expanded",
}: Props = $props();
</script>

<CoverImage
	cover={currentSong.cover}
	{isPlaying}
	{isLoading}
	{size}
	interactive={false}
/>
