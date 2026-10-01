<script lang="ts">
import Icon from "@iconify/svelte";

interface Props {
	onclick: () => void;
	disabled?: boolean;
}

const { onclick, disabled = false }: Props = $props();
</script>

<button
	class="btn-plain w-10 h-10 rounded-lg"
	aria-label="上一首"
	{onclick}
	{disabled}
>
	<Icon icon="lucide:skip-back" class="text-xl" />
</button>
