<script lang="ts">
import Icon from "@iconify/svelte";
import { onDestroy, onMount } from "svelte";
import { guestbookWidgetStore } from "@/stores/guestbookWidgetStore";
import GuestbookChat from "./GuestbookChat.svelte";
import "./guestbook-chat.css";

let widgetState = $state(guestbookWidgetStore.getState());
let unsubscribe: (() => void) | undefined;

onMount(() => {
	unsubscribe = guestbookWidgetStore.subscribe((nextState) => {
		widgetState = nextState;
	});
});

onDestroy(() => {
	unsubscribe?.();
});
</script>

{#if widgetState.isOpen}
	<div class="guestbook-widget">
		<div class="guestbook-widget__backdrop" onclick={() => guestbookWidgetStore.close()}></div>
		<aside
			class="guestbook-widget__panel card-base shadow-xl"
			role="dialog"
			aria-label="留言板"
			aria-modal="true"
		>
			<header class="guestbook-widget__header">
				<div class="guestbook-widget__title">
					<Icon icon="lucide:message-square-text" width={18} height={18} />
					<span>留言板</span>
				</div>
				<button
					type="button"
					class="guestbook-widget__close"
					onclick={() => guestbookWidgetStore.close()}
					aria-label="关闭留言板"
					title="关闭留言板"
				>
					<Icon icon="lucide:x" width={20} height={20} />
				</button>
			</header>
			<div class="guestbook-widget__body">
				<GuestbookChat />
			</div>
		</aside>
	</div>
{/if}

<style>
	.guestbook-widget {
		position: fixed;
		inset: 0;
		z-index: 80;
		pointer-events: none;
	}

	.guestbook-widget__backdrop {
		position: absolute;
		inset: 0;
		background: rgb(0 0 0 / 0.32);
		backdrop-filter: blur(3px);
		pointer-events: auto;
		animation: guestbook-widget-fade 200ms ease-out;
	}

	.guestbook-widget__panel {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		width: min(44rem, calc(100vw - 2.5rem));
		height: min(85dvh, 50rem);
		min-height: 26rem;
		overflow: hidden;
		border: 1px solid var(--line-color);
		border-radius: 1.25rem;
		background: var(--card-bg);
		box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.3);
		pointer-events: auto;
		animation: guestbook-widget-in 240ms cubic-bezier(0.22, 1.25, 0.36, 1);
		transform-origin: center;
	}

	.guestbook-widget__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--line-color);
		background: var(--card-bg-transparent);
	}

	.guestbook-widget__title {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--deep-text);
	}

	.guestbook-widget__title :global(svg) {
		color: var(--primary);
	}

	.guestbook-widget__close {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--content-meta);
		cursor: pointer;
		transition: background-color 160ms ease, color 160ms ease;
	}

	.guestbook-widget__close:hover {
		background: var(--btn-regular-bg-hover);
		color: var(--deep-text);
	}

	.guestbook-widget__body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.guestbook-widget__body :global(.guestbook-chat) {
		flex: 1 1 auto;
		min-height: 0;
		height: auto;
		border: 0;
		border-radius: 0;
	}

	@keyframes guestbook-widget-in {
		from {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}

	@keyframes guestbook-widget-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (max-width: 768px) {
		.guestbook-widget__panel {
			left: 0;
			top: 0;
			transform: none;
			inset: 0;
			width: 100%;
			height: 100dvh;
			min-height: 0;
			max-height: none;
			border: 0;
			border-radius: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.guestbook-widget__panel,
		.guestbook-widget__backdrop {
			animation-duration: 0.01ms !important;
		}
	}
</style>
