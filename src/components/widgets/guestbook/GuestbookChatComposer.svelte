<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount, tick } from "svelte";
import { type EmojiItem, type EmojiPack, loadEmojiPacks } from "./lib/emoji";
import { getServerConfig } from "./lib/twikooClient";
import type { GuestbookChatMessage as Message, GuestbookProfile } from "./lib/types";
import { MAX_IMAGE_SIZE_BYTES, MAX_MESSAGE_LENGTH, readImageAsDataUrl } from "./lib/utils";

interface Props {
	profile: GuestbookProfile;
	draft: string;
	replyTarget: Message | null;
	composerError: string;
	isOffline: boolean;
	isSending: boolean;
	onProfileChange: (profile: GuestbookProfile) => void;
	onDraftChange: (draft: string) => void;
	onReplyCancel: () => void;
	onSend: (content: string) => Promise<boolean>;
	onToolError: (message: string) => void;
}

let {
	profile,
	draft,
	replyTarget,
	composerError,
	isOffline,
	isSending,
	onProfileChange,
	onDraftChange,
	onReplyCancel,
	onSend,
	onToolError,
}: Props = $props();

let textarea = $state<HTMLTextAreaElement | null>(null);
let profileDialog = $state<HTMLDialogElement | null>(null);
let profileNickInput = $state<HTMLInputElement | null>(null);
let isComposing = $state(false);
let manualTextareaHeight = $state<number | null>(null);
let resizePointerId = $state<number | null>(null);
let profileDraft = $state<GuestbookProfile>({ nick: "", mail: "", link: "" });
let profileDialogError = $state("");
let resizeStartY = 0;
let resizeStartHeight = 0;

let pendingImage = $state<{ name: string; url: string; size: number } | null>(null);
let isProcessingImage = $state(false);
let fileInput = $state<HTMLInputElement | null>(null);

/* === 表情（与评论区同源，数据地址取自 Twikoo 服务端配置） === */
let emojiTrigger = $state<HTMLButtonElement | null>(null);
let emojiPanel = $state<HTMLDivElement | null>(null);
let isEmojiOpen = $state(false);
let emojiPacks = $state<EmojiPack[]>([]);
let activeEmojiPack = $state(0);
let emojiStatus = $state<"idle" | "loading" | "ready" | "error">("idle");
let emojiError = $state("");
/** 站长在 Twikoo 后台关掉表情时（SHOW_EMOTION !== "true"）不显示入口，与官方一致 */
let showEmotion = $state(false);
let emotionCdn = "";

const inputDisabled = $derived(isOffline);
const currentEmojiItems = $derived(emojiPacks[activeEmojiPack]?.items ?? []);
const hasGuestProfile = $derived(profile.nick.trim().length >= 2);

async function openGuestProfile() {
	profileDraft = { ...profile };
	profileDialogError = "";
	if (!profileDialog?.open) profileDialog?.showModal();
	document.body.style.overflow = "hidden";
	await tick();
	profileNickInput?.focus();
}

function closeGuestProfile() {
	if (profileDialog?.open) profileDialog.close();
	profileDialogError = "";
	document.body.style.overflow = "";
}

function validateGuestProfile(nextProfile: GuestbookProfile): string {
	if (nextProfile.nick.length < 2) return "昵称至少需要 2 个字符";
	if (
		nextProfile.mail &&
		!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(nextProfile.mail)
	) {
		return "邮箱格式不正确";
	}
	if (nextProfile.link) {
		try {
			const website = new URL(nextProfile.link);
			if (website.protocol !== "http:" && website.protocol !== "https:") {
				return "网站地址仅支持 http 或 https";
			}
		} catch {
			return "网站地址格式不正确";
		}
	}
	return "";
}

function saveGuestProfile() {
	const nextProfile = {
		nick: profileDraft.nick.trim(),
		mail: profileDraft.mail.trim(),
		link: profileDraft.link.trim(),
	};
	profileDialogError = validateGuestProfile(nextProfile);
	if (profileDialogError) return;
	onProfileChange(nextProfile);
	onToolError("");
	closeGuestProfile();
}

function resizeTextarea() {
	if (!textarea) return;
	if (manualTextareaHeight !== null) return;
	textarea.style.height = "auto";
	textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
}

function getTextareaHeightBounds() {
	if (!textarea) return null;
	const styles = getComputedStyle(textarea);
	const minHeight = Number.parseFloat(styles.minHeight);
	const cssMaxHeight = Number.parseFloat(styles.maxHeight);
	const currentHeight = textarea.getBoundingClientRect().height;
	const configuredMax = Number.isFinite(cssMaxHeight)
		? cssMaxHeight
		: window.innerHeight * 0.45;
	const minimum = Number.isFinite(minHeight) ? minHeight : 56;
	return {
		min: minimum,
		max: Math.max(minimum, configuredMax),
		current: currentHeight,
	};
}

function setTextareaHeight(height: number) {
	if (!textarea) return;
	const bounds = getTextareaHeightBounds();
	if (!bounds) return;
	const nextHeight = Math.round(
		Math.min(bounds.max, Math.max(bounds.min, height)),
	);
	manualTextareaHeight = nextHeight;
	textarea.style.height = `${nextHeight}px`;
}

function startTextareaResize(event: PointerEvent) {
	if (!textarea || event.button !== 0) return;
	event.preventDefault();
	resizePointerId = event.pointerId;
	resizeStartY = event.clientY;
	resizeStartHeight = textarea.getBoundingClientRect().height;
	(event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
}

function moveTextareaResize(event: PointerEvent) {
	if (resizePointerId !== event.pointerId) return;
	setTextareaHeight(resizeStartHeight + resizeStartY - event.clientY);
}

function finishTextareaResize(event: PointerEvent) {
	if (resizePointerId !== event.pointerId) return;
	const handle = event.currentTarget as HTMLButtonElement;
	if (handle.hasPointerCapture(event.pointerId)) {
		handle.releasePointerCapture(event.pointerId);
	}
	resizePointerId = null;
}

function handleResizeKeydown(event: KeyboardEvent) {
	if (
		!textarea ||
		!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
	) {
		return;
	}
	event.preventDefault();
	const bounds = getTextareaHeightBounds();
	if (!bounds) return;
	if (event.key === "Home") setTextareaHeight(bounds.min);
	else if (event.key === "End") setTextareaHeight(bounds.max);
	else {
		setTextareaHeight(
			bounds.current +
				(event.key === "ArrowUp" ? 16 : -16),
		);
	}
}

function handleWindowResize() {
	if (manualTextareaHeight !== null) {
		setTextareaHeight(manualTextareaHeight);
	}
}

function handleInput(event: Event) {
	onDraftChange((event.currentTarget as HTMLTextAreaElement).value);
	resizeTextarea();
}

function handleKeydown(event: KeyboardEvent) {
	if (
		event.key !== "Enter" ||
		event.shiftKey ||
		event.isComposing ||
		isComposing
	) {
		return;
	}
	event.preventDefault();
	void submitMessage();
}

/* === 表情面板 === */

/**
 * 读取 Twikoo 服务端配置决定是否显示表情入口、以及表情数据地址。
 * getServerConfig 内部有模块级缓存，此处与留言列表共用同一次请求。
 */
onMount(() => {
	void (async () => {
		try {
			const config = await getServerConfig();
			// 官方 SDK 判定：'true' === config.SHOW_EMOTION
			showEmotion = config.SHOW_EMOTION === "true";
			emotionCdn =
				typeof config.EMOTION_CDN === "string" ? config.EMOTION_CDN : "";
		} catch {
			// 配置拉取失败：隐藏表情入口，不影响正常发言
		}
	})();
});

async function ensureEmojiPacks() {
	if (emojiStatus === "loading" || emojiStatus === "ready") return;
	emojiStatus = "loading";
	emojiError = "";
	try {
		const packs = await loadEmojiPacks(emotionCdn);
		emojiPacks = packs;
		activeEmojiPack = 0;
		if (packs.length === 0) {
			emojiStatus = "error";
			emojiError = "表情包为空";
			return;
		}
		emojiStatus = "ready";
	} catch (error) {
		emojiStatus = "error";
		emojiError = error instanceof Error ? error.message : "表情加载失败";
	}
}

function toggleEmojiPanel() {
	isEmojiOpen = !isEmojiOpen;
	// 首次打开才拉取 owo.json（约 100KB），避免拖慢留言板首屏
	if (isEmojiOpen) void ensureEmojiPacks();
}

/**
 * 插入表情，规则与官方 OwO 组件一致：
 *   图片表情插入短码 `:text: `（服务端存短码，渲染时再翻译成图片）
 *   颜文字 / Emoji 直接插入字符本身
 * 这样留言板与评论区互发的表情内容格式相同，两边都能正确显示。
 */
async function insertEmoji(item: EmojiItem) {
	const insertText = item.src ? `:${item.text}: ` : item.icon;
	const caret = textarea?.selectionEnd ?? draft.length;
	const next = draft.slice(0, caret) + insertText + draft.slice(caret);
	// textarea 的 maxlength 拦不住程序化写入，这里自己兜底
	if (next.length > MAX_MESSAGE_LENGTH) {
		onToolError(`内容不能超过 ${MAX_MESSAGE_LENGTH} 个字符`);
		return;
	}
	onDraftChange(next);
	await tick();
	if (!textarea) return;
	const position = caret + insertText.length;
	textarea.focus();
	textarea.setSelectionRange(position, position);
	resizeTextarea();
}

function closeEmojiPanel(refocusTrigger = false) {
	if (!isEmojiOpen) return;
	isEmojiOpen = false;
	if (refocusTrigger) emojiTrigger?.focus();
}

function handleGlobalPointerDown(event: PointerEvent) {
	if (!isEmojiOpen) return;
	const target = event.target as Node | null;
	if (!target) return;
	if (emojiPanel?.contains(target) || emojiTrigger?.contains(target)) return;
	closeEmojiPanel();
}

function handleGlobalKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") closeEmojiPanel(true);
}

/* === 图片粘贴/拖拽 === */
async function handleImageFile(file: File) {
	if (isProcessingImage) return;
	isProcessingImage = true;
	onToolError("");
	try {
		const result = await readImageAsDataUrl(file);
		if ("error" in result) {
			onToolError(result.error);
			return;
		}
		pendingImage = {
			name: file.name.replace(/[[\]]/gu, "").replace(/\.[^.]+$/u, "") || "图片",
			url: result.url,
			size: result.size,
		};
	} finally {
		isProcessingImage = false;
	}
}

function handlePaste(event: ClipboardEvent) {
	const items = event.clipboardData?.items;
	if (!items) return;
	for (const item of Array.from(items)) {
		if (item.kind === "file") {
			const file = item.getAsFile();
			if (file && file.type.startsWith("image/")) {
				event.preventDefault();
				void handleImageFile(file);
				return;
			}
		}
	}
}

function handleDrop(event: DragEvent) {
	const files = event.dataTransfer?.files;
	if (!files || files.length === 0) return;
	const imageFile = Array.from(files).find((f) =>
		f.type.startsWith("image/"),
	);
	if (!imageFile) return;
	event.preventDefault();
	void handleImageFile(imageFile);
}

function clearPendingImage() {
	pendingImage = null;
}

async function submitMessage() {
	if (!hasGuestProfile) {
		onToolError("请先填写昵称（游客访问）后再发送");
		return;
	}
	const content = pendingImage
		? `${draft.trim()}\n\n![${pendingImage.name}](${pendingImage.url})`.trim()
		: draft.trim();
	const accepted = await onSend(content);
	if (accepted) {
		onDraftChange("");
		clearPendingImage();
		textarea?.focus();
	}
}
</script>

<svelte:window
	onresize={handleWindowResize}
	onpointerdown={handleGlobalPointerDown}
	onkeydown={handleGlobalKeydown}
/>

<footer class="guestbook-composer">
	{#if replyTarget}
		<div class="guestbook-composer__reply">
			<Icon icon="lucide:reply" width={16} height={16} />
			<div>
				<span>回复 @{replyTarget.nick}</span>
				<small>{replyTarget.body.replace(/<[^>]*>/gu, "").slice(0, 80)}</small>
			</div>
			<button
				type="button"
				onclick={onReplyCancel}
				aria-label="取消引用"
				title="取消引用"
			>
				<Icon icon="lucide:x" width={18} height={18} />
			</button>
		</div>
	{/if}

	<div
		class:is-resizing={resizePointerId !== null}
		class="guestbook-composer__editor"
	>
		<button
			class="guestbook-composer__resize-handle"
			type="button"
			onpointerdown={startTextareaResize}
			onpointermove={moveTextareaResize}
			onpointerup={finishTextareaResize}
			onpointercancel={finishTextareaResize}
			onkeydown={handleResizeKeydown}
			aria-label="调整输入框高度"
			title="向上拖动扩大输入框"
		></button>

		{#if isEmojiOpen}
			<div class="guestbook-composer__emojis" bind:this={emojiPanel}>
				{#if emojiStatus === "ready"}
					<div class="guestbook-composer__emoji-tabs" role="tablist">
						{#each emojiPacks as pack, index (index)}
							<button
								type="button"
								role="tab"
								aria-selected={index === activeEmojiPack}
								class:is-active={index === activeEmojiPack}
								title={pack.tabText || `表情包 ${index + 1}`}
								onclick={() => (activeEmojiPack = index)}
							>
								{#if pack.tabSrc}
									<img src={pack.tabSrc} alt="" loading="lazy" />
								{:else}
									<span>{pack.tabText}</span>
								{/if}
							</button>
						{/each}
					</div>
					<div
						class="guestbook-composer__emoji-grid"
						class:is-emoji={emojiPacks[activeEmojiPack]?.type === "emoji"}
						class:is-text={emojiPacks[activeEmojiPack]?.type === "emoticon"}
					>
						{#each currentEmojiItems as item, index (index)}
							<button
								type="button"
								title={item.text}
								onclick={() => void insertEmoji(item)}
							>
								{#if item.src}
									<img src={item.src} alt={item.text} loading="lazy" />
								{:else}
									<span>{item.icon}</span>
								{/if}
							</button>
						{/each}
					</div>
				{:else if emojiStatus === "error"}
					<div class="guestbook-composer__emoji-state">
						<span>{emojiError}</span>
						<button type="button" onclick={() => void ensureEmojiPacks()}>
							重试
						</button>
					</div>
				{:else}
					<div class="guestbook-composer__emoji-state">
						<Icon
							icon="lucide:loader-circle"
							class="is-spinning"
							width={16}
							height={16}
						/>
						<span>表情加载中…</span>
					</div>
				{/if}
			</div>
		{/if}

		<textarea
			bind:this={textarea}
			value={draft}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onpaste={handlePaste}
			ondrop={handleDrop}
			oncompositionstart={() => (isComposing = true)}
			oncompositionend={() => (isComposing = false)}
			rows="3"
			maxlength={MAX_MESSAGE_LENGTH}
			placeholder="说点什么...（支持 :表情: 和粘贴图片）"
			aria-label="留言内容"
			disabled={inputDisabled}
		></textarea>

		{#if pendingImage}
			<div class="guestbook-composer__image-preview">
				<img src={pendingImage.url} alt={pendingImage.name} />
				<span>{pendingImage.name}（{(pendingImage.size / 1024).toFixed(0)} KB）</span>
				<button
					type="button"
					onclick={clearPendingImage}
					aria-label="移除待发送图片"
					title="移除图片"
				>
					<Icon icon="lucide:x" width={16} height={16} />
				</button>
			</div>
		{/if}

		<div class="guestbook-composer__footer">
			<div class="guestbook-composer__actions">
				<span class="guestbook-composer__count">{draft.length}/{MAX_MESSAGE_LENGTH}</span>
				{#if showEmotion}
					<button
						bind:this={emojiTrigger}
						type="button"
						class="guestbook-composer__emoji-trigger"
						class:is-active={isEmojiOpen}
						onclick={toggleEmojiPanel}
						aria-label="插入表情"
						aria-expanded={isEmojiOpen}
						title="表情"
						disabled={inputDisabled}
					>
						<Icon icon="lucide:smile" width={18} height={18} />
					</button>
				{/if}
				<button
					type="button"
					class="guestbook-composer__image-trigger"
					onclick={() => fileInput?.click()}
					aria-label="上传图片（粘贴或拖拽也可）"
					title="图片（≤128KB）"
					disabled={inputDisabled || isProcessingImage}
				>
					<Icon
						icon={isProcessingImage ? "lucide:loader-circle" : "lucide:image"}
						class={isProcessingImage ? "is-spinning" : ""}
						width={18}
						height={18}
					/>
				</button>
				<input
					bind:this={fileInput}
					class="guestbook-composer__file-input"
					type="file"
					accept="image/png,image/jpeg,image/gif,image/webp"
					onchange={(e) => {
						const f = (e.currentTarget as HTMLInputElement).files?.[0];
						if (f) void handleImageFile(f);
						(e.currentTarget as HTMLInputElement).value = "";
					}}
					tabindex="-1"
					aria-hidden="true"
				/>
			</div>
			<div class="guestbook-composer__tools">
				<button
					class="guestbook-composer__guest-profile"
					type="button"
					onclick={() => void openGuestProfile()}
					title={hasGuestProfile ? `游客：${profile.nick}（点击修改）` : "填写游客资料"}
				>
					{hasGuestProfile ? profile.nick : "游客访问"}
				</button>
				<button
					class="guestbook-composer__send"
					type="button"
					onclick={() => void submitMessage()}
					disabled={inputDisabled || isSending || isProcessingImage}
					aria-busy={isSending}
				>
					{isSending ? "发送中" : "发送"}
				</button>
			</div>
		</div>

	{#if composerError}
		<div class="guestbook-composer__error" role="alert">
			<Icon icon="lucide:triangle-alert" width={16} height={16} />
			<span>{composerError}</span>
			<button
				type="button"
				onclick={() => onToolError("")}
				aria-label="关闭提示"
				title="关闭提示"
			>
				<Icon icon="lucide:x" width={15} height={15} />
			</button>
		</div>
		{/if}
	</div>
</footer>

<dialog
	bind:this={profileDialog}
	class="guestbook-modal guestbook-profile-modal"
	aria-labelledby="guestbook-profile-title"
	onclose={() => {
		profileDialogError = "";
		document.body.style.overflow = "";
	}}
	oncancel={(event) => {
		event.preventDefault();
		closeGuestProfile();
	}}
>
	<div class="guestbook-modal__overlay" onclick={closeGuestProfile}></div>
	<form
		class="guestbook-modal__panel guestbook-profile-modal__panel"
		onsubmit={(event) => {
			event.preventDefault();
			saveGuestProfile();
		}}
	>
		<div class="guestbook-modal__header">
			<h2 id="guestbook-profile-title">游客资料</h2>
			<button
				class="guestbook-modal__close"
				type="button"
				onclick={closeGuestProfile}
				aria-label="关闭游客资料"
			>
				<Icon icon="lucide:x" width={20} height={20} />
			</button>
		</div>
		<div class="guestbook-modal__body guestbook-profile-modal__body">
			<label>
				<span>昵称</span>
				<input
					bind:this={profileNickInput}
					bind:value={profileDraft.nick}
					maxlength="30"
					autocomplete="nickname"
					placeholder="至少 2 个字符"
					required
				/>
			</label>
			<label>
				<span>邮箱</span>
				<input
					bind:value={profileDraft.mail}
					maxlength="100"
					type="email"
					autocomplete="email"
					placeholder="用于头像，不公开"
				/>
			</label>
			<label>
				<span>网址</span>
				<input
					bind:value={profileDraft.link}
					maxlength="200"
					type="url"
					autocomplete="url"
					placeholder="可选"
				/>
			</label>
			{#if profileDialogError}
				<p class="guestbook-profile-modal__error" role="alert">
					{profileDialogError}
				</p>
			{/if}
		</div>
		<div class="guestbook-modal__footer guestbook-profile-modal__actions">
			<button type="button" onclick={closeGuestProfile}>取消</button>
			<button class="guestbook-modal__confirm" type="submit">保存资料</button>
		</div>
	</form>
</dialog>