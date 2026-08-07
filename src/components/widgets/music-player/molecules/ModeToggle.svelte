<script lang="ts">
import type { PlayerMode } from "../types";

interface Props {
	mode: PlayerMode;
	onChange: (mode: PlayerMode) => void;
}

const { mode, onChange }: Props = $props();
</script>

<div class="mode-toggle" role="tablist" aria-label="播放模式切换">
	<span
		class="mode-toggle-thumb"
		class:mode-toggle-thumb--local={mode === "local"}
		aria-hidden="true"
	></span>
	<button
		type="button"
		class="mode-toggle-option"
		class:active={mode === "online"}
		role="tab"
		aria-selected={mode === "online"}
		onclick={() => onChange("online")}
	>
		网易云
	</button>
	<button
		type="button"
		class="mode-toggle-option"
		class:active={mode === "local"}
		role="tab"
		aria-selected={mode === "local"}
		onclick={() => onChange("local")}
	>
		本地
	</button>
</div>

<style>
	.mode-toggle {
		position: relative;
		display: inline-flex;
		align-items: stretch;
		padding: 3px;
		border: 1px solid var(--line-color);
		border-radius: 9999px;
		background: color-mix(in srgb, var(--card-bg) 35%, transparent);
	}

	.mode-toggle-option {
		position: relative;
		z-index: 1;
		flex: 1 1 0;
		min-width: 4.5rem;
		padding: 0.4rem 0.9rem;
		border: none;
		background: transparent;
		border-radius: 9999px;
		font-size: 0.8rem;
		font-weight: 600;
		line-height: 1;
		color: var(--content-meta);
		cursor: pointer;
		transition: color 0.2s ease;
		white-space: nowrap;
	}

	.mode-toggle-option:hover {
		color: var(--content-main);
	}

	.mode-toggle-option.active {
		color: #fff;
	}

	.mode-toggle-thumb {
		position: absolute;
		top: 3px;
		bottom: 3px;
		left: 3px;
		width: calc(50% - 3px);
		border-radius: 9999px;
		background: var(--primary);
		box-shadow: 0 1px 4px color-mix(in srgb, var(--primary) 45%, transparent);
		transform: translateX(0);
		transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
		z-index: 0;
	}

	.mode-toggle-thumb--local {
		transform: translateX(100%);
	}
</style>
