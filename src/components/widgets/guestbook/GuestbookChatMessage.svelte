<script lang="ts">
import Icon from "@iconify/svelte";
import type { GuestbookMessage } from "./lib/types";
import { getInitials } from "./lib/utils";

interface Props {
	message: GuestbookMessage;
	referencedMessage?: GuestbookMessage;
	timeLabel: string;
	canManage: boolean;
	onReply: (message: GuestbookMessage) => void;
	onDelete: (message: GuestbookMessage) => void;
	onJump: (message: GuestbookMessage) => void;
	onRetry: (message: GuestbookMessage) => void;
	onDiscard: (message: GuestbookMessage) => void;
	onCopyError: (message: string) => void;
}

let {
	message,
	referencedMessage,
	timeLabel,
	canManage,
	onReply,
	onDelete,
	onJump,
	onRetry,
	onDiscard,
	onCopyError,
}: Props = $props();

let copied = $state(false);

const quotePreview = $derived(
	referencedMessage
		? referencedMessage.body.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").slice(0, 72)
		: "原消息暂未加载",
);

async function copyMessage() {
	try {
		await navigator.clipboard.writeText(message.body.replace(/<[^>]*>/gu, ""));
		copied = true;
		window.setTimeout(() => (copied = false), 1600);
	} catch {
		onCopyError("复制失败，请检查浏览器剪贴板权限");
	}
}
</script>

<article
	id={`guestbook-message-${message.id}`}
	class:is-admin={message.isAdmin}
	class:is-failed={message.localState === "failed"}
	class:is-sending={message.localState === "sending"}
	class="guestbook-message"
>
	<div class="guestbook-message__avatar" aria-hidden="true">
		<span>{getInitials(message.nick)}</span>
		{#if message.avatar}
			<img
				src={message.avatar}
				alt=""
				loading="lazy"
				referrerpolicy="no-referrer"
				onerror={(event) =>
					((event.currentTarget as HTMLImageElement).style.display = "none")}
			/>
		{/if}
	</div>

	<div class="guestbook-message__column">
		<div class="guestbook-message__heading">
			<span class="guestbook-message__author">
				{#if message.link}
					<a
						class="guestbook-message__author-link"
						href={message.link}
						target="_blank"
						rel="nofollow noopener noreferrer"
						title={`访问 ${message.nick} 的网站`}
					>
						{message.nick}
					</a>
				{:else}
					<strong>{message.nick}</strong>
				{/if}
			</span>
			{#if message.isAdmin}
				<span class="guestbook-message__badge guestbook-message__badge--admin">站长</span>
			{/if}
			{#if message.label}
				<span class="guestbook-message__badge guestbook-message__badge--waiting">{message.label}</span>
			{/if}
			<time
				class="guestbook-message__time"
				datetime={new Date(message.createdAt).toISOString()}>{timeLabel}</time
			>
		</div>

		<div class="guestbook-message__bubble-row">
			<div class="guestbook-message__bubble">
				{#if message.replyToId}
					<button
						class="guestbook-message__quote"
						type="button"
						onclick={() => onJump(message)}
						title="跳转到原消息"
					>
						<Icon
							icon="lucide:arrow-up-to-line"
							class="guestbook-message__quote-jump"
							width={15}
							height={15}
						/>
						<span>@{message.replyToNick || "访客"}</span>
						<small>{quotePreview}</small>
					</button>
				{/if}
				<div class="guestbook-message__body">{@html message.body}</div>
			</div>

			{#if !message.localState}
				<div class="guestbook-message__tools" role="group" aria-label="消息操作">
					<button
						type="button"
						onclick={() => onReply(message)}
						aria-label={`回复 ${message.nick}`}
						title="引用回复"
					>
						<Icon icon="lucide:reply" width={15} height={15} />
					</button>
					<button
						type="button"
						onclick={copyMessage}
						aria-label={copied ? "已复制" : "复制消息"}
						title={copied ? "已复制" : "复制消息"}
					>
						<Icon
							icon={copied ? "lucide:check" : "lucide:copy"}
							width={15}
							height={15}
						/>
					</button>
					{#if canManage}
						<button
							type="button"
							onclick={() => onDelete(message)}
							aria-label="删除消息"
							title="删除消息"
						>
							<Icon icon="lucide:trash-2" width={15} height={15} />
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<div class="guestbook-message__meta">
			{#if message.browser}
				<span><Icon icon="lucide:monitor" width={14} height={14} />{message.browser}</span>
			{/if}
			{#if message.os}
				<span><Icon icon="lucide:laptop" width={14} height={14} />{message.os}</span>
			{/if}
			{#if message.addr}
				<span><Icon icon="lucide:map-pin" width={14} height={14} />{message.addr}</span>
			{/if}
			{#if message.localState === "sending"}
				<span>
					<Icon icon="lucide:loader-circle" class="is-spinning" width={14} height={14} />发送中
				</span>
			{/if}
		</div>

		{#if message.localState === "failed"}
			<div class="guestbook-message__failure" role="alert">
				<span>{message.failureReason}</span>
				<button type="button" onclick={() => onRetry(message)}>
					<Icon icon="lucide:rotate-ccw" width={14} height={14} />重试
				</button>
				<button type="button" onclick={() => onDiscard(message)}>
					<Icon icon="lucide:trash-2" width={14} height={14} />删除
				</button>
			</div>
		{/if}
	</div>
</article>
