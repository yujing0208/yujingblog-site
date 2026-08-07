<script lang="ts">
import Icon from "@iconify/svelte";
import { onDestroy, onMount } from "svelte";
import { guestbookWidgetStore } from "@/stores/guestbookWidgetStore";

let widgetState = $state(guestbookWidgetStore.getState());
let unsubscribe: (() => void) | undefined;

const ariaLabel = $derived(
	widgetState.isOpen ? "关闭留言板" : "打开留言板",
);

onMount(() => {
	unsubscribe = guestbookWidgetStore.subscribe((nextState) => {
		widgetState = nextState;
	});
});

onDestroy(() => {
	unsubscribe?.();
});
</script>

<button
	type="button"
	class:active={widgetState.isOpen}
	class="guestbook-fab btn-card"
	aria-label={ariaLabel}
	title={ariaLabel}
	aria-expanded={widgetState.isOpen}
	onclick={() => guestbookWidgetStore.toggle()}
>
	<span class="guestbook-fab__icon" aria-hidden="true">
		<Icon icon="lucide:message-square-text" />
	</span>
</button>

<style>
	.guestbook-fab {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--fab-button-size, 3rem);
		height: var(--fab-button-size, 3rem);
		min-width: 0;
		min-height: 0;
		padding: 0.25rem;
		border: 1px solid rgba(148, 163, 184, 0.45);
		border-radius: 1rem;
		cursor: pointer;
		color: var(--primary);
		pointer-events: auto;
		transition:
			transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 0.3s ease,
			background 0.3s ease;
	}

	.guestbook-fab:hover {
		box-shadow: var(--shadow-button);
	}

	.guestbook-fab:active {
		transform: scale(0.94);
	}

	.guestbook-fab.active {
		background: var(--btn-card-bg-active);
	}

	.guestbook-fab__icon {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		line-height: 1;
	}

	:global(.dark) .guestbook-fab {
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	:global(.dark) .guestbook-fab:hover {
		box-shadow: var(--shadow-button-dark);
	}

	@media (width < 768px) {
		.guestbook-fab {
			border-radius: 0.75rem;
		}

		.guestbook-fab__icon {
			font-size: 1.4rem;
		}
	}

	@media (width < 480px) {
		.guestbook-fab {
			border-radius: 0.5rem;
		}
	}
</style>
