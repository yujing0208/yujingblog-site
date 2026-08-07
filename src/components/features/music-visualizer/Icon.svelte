<script lang="ts">
// 图标封装：复用 Mizuki 已安装的 @iconify/svelte（运行时从 Iconify API 加载）
import Icon from "@iconify/svelte";

interface Props {
	icon: string;
	size?: string;
	class?: string;
	style?: string;
}

let { icon, size = "1em", class: className = "", style = "" }: Props = $props();

const sizeMap: Record<string, string> = {
	sm: "1em",
	md: "1.25em",
	lg: "1.5em",
	xl: "1.75em",
	"2xl": "2.25em",
};

const fontSize = $derived(sizeMap[size] ?? size);
</script>

<Icon {icon} class={className} style={`font-size:${fontSize};${style}`} />
