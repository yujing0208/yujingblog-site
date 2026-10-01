<script lang="ts">
import Icon from "@iconify/svelte";

interface Props {
	volume: number;
	isMuted: boolean;
	onclick: () => void;
}

const { volume, isMuted, onclick }: Props = $props();
</script>

<button class="btn-plain w-8 h-8 rounded-lg" {onclick}>
	{#if isMuted || volume === 0}
		<Icon icon="lucide:volume-x" class="text-lg" />
	{:else if volume < 0.5}
		<Icon icon="lucide:volume-1" class="text-lg" />
	{:else}
		<Icon icon="lucide:volume-2" class="text-lg" />
	{/if}
</button>
