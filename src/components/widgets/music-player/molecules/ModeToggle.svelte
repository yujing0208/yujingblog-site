<script lang="ts">
import type { PlayerMode } from "../types";

interface Props {
	mode: PlayerMode;
	onChange: (mode: PlayerMode) => void;
}

const { mode, onChange }: Props = $props();
</script>

<!-- 本地/网易云 音源切换：本地在前（默认），网易云在后。非滑动胶囊，点击即切换 -->
<div class="mode-toggle" role="group" aria-label="音源切换">
	<button
		type="button"
		class="mode-toggle__opt"
		class:mode-toggle__opt--active={mode === "local"}
		aria-pressed={mode === "local"}
		onclick={() => onChange("local")}
	>
		本地
	</button>
	<button
		type="button"
		class="mode-toggle__opt"
		class:mode-toggle__opt--active={mode === "online"}
		aria-pressed={mode === "online"}
		onclick={() => onChange("online")}
	>
		网易云
	</button>
</div>

<style>
	.mode-toggle {
		display: flex;
		width: 100%;
		border-radius: 0.6rem;
		overflow: hidden;
		border: 1px solid
			color-mix(in srgb, var(--line-divider) 60%, transparent);
	}

	.mode-toggle__opt {
		flex: 1;
		padding: 0.45rem 0;
		background: transparent;
		border: none;
		color: var(--content-meta);
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}

	.mode-toggle__opt:first-child {
		border-right: 1px solid
			color-mix(in srgb, var(--line-divider) 60%, transparent);
	}

	.mode-toggle__opt:hover {
		color: var(--primary);
	}

	.mode-toggle__opt--active {
		background: color-mix(in srgb, var(--primary) 14%, transparent);
		color: var(--primary);
		font-weight: 600;
	}
</style>
