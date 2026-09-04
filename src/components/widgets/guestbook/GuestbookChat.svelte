<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount, tick } from "svelte";
import {
	type GuestbookAnnouncementItem,
	guestbookConfig,
} from "@/config/guestbookConfig";
import GuestbookChatComposer from "./GuestbookChatComposer.svelte";
import GuestbookChatMessage from "./GuestbookChatMessage.svelte";
import { loadEmojiPacks, setEmotionCdn } from "./lib/emoji";
import {
	deleteComment as apiDeleteComment,
	updateComment as apiUpdateComment,
	getComments,
	getServerConfig,
	isAdminLoggedIn,
	loginAdmin,
	logoutAdmin,
	submitComment,
} from "./lib/walineClient";
import type { GuestbookMessage, GuestbookProfile } from "./lib/types";
import {
	applyServerConfig,
	dateLabel,
	flattenComments,
	formatMessageTime,
	mergeMessages,
	renderMessageMarkdown,
	shouldShowDate,
	validateMessageBody,
} from "./lib/utils";

const PAGE_SIZE = 30;
const POLL_INTERVAL = 30_000;
const PROFILE_STORAGE_KEY = "guestbook-chat-profile";
const DRAFT_STORAGE_KEY = "guestbook-chat-draft";

let messages = $state<GuestbookMessage[]>([]);
let profile = $state<GuestbookProfile>({ nick: "", mail: "", link: "" });
let draft = $state("");
let replyTarget = $state<GuestbookMessage | null>(null);
let initialLoading = $state(true);
let initialError = $state("");
let syncError = $state("");
let composerError = $state("");
/** 表情入口开关：与评论区同源，在拉取 Twikoo 服务端配置时统一判定后下发到输入框，
 *  与图片按钮共用同一次配置请求，确保两者同时出现。默认 true 以便首屏直接显示。 */
let emojiEnabled = $state(true);
let loadingOlder = $state(false);
let syncing = $state(false);
let isOffline = $state(false);
let announcementBarVisible = $state(true);
let announcementDialog = $state<HTMLDialogElement | null>(null);
let selectedAnnouncement = $state<GuestbookAnnouncementItem | null>(null);
let currentPage = $state(1);
let totalPages = $state(0);
let totalCount = $state(0);
let newMessageCount = $state(0);
let lastSyncedAt = $state<number | null>(null);
let messageList = $state<HTMLDivElement | null>(null);
let deleteDialog = $state<HTMLDialogElement | null>(null);
let showScrollToBottom = $state(false);
let mutatingMessageId = $state<string | null>(null);
let messageActionError = $state<{ id: string; message: string } | null>(null);
let deleteTarget = $state<GuestbookMessage | null>(null);
let pollTimer: number | undefined;
let dataController: AbortController | null = null;
let syncQueued = false;

let memberSidebarOpen = $state(false);
let profileCardTarget = $state<GuestbookMessage | null>(null);
let profileCardDialog = $state<HTMLDialogElement | null>(null);
let profileCardMessageCount = $state(0);
let editingTarget = $state<GuestbookMessage | null>(null);
let editDraft = $state("");
let editError = $state("");
let editDialog = $state<HTMLDialogElement | null>(null);
let adminDialog = $state<HTMLDialogElement | null>(null);
let adminPassword = $state("");
let adminLoginError = $state("");
let isAdmin = $state(isAdminLoggedIn());

const hasMore = $derived(currentPage < totalPages);
const isSending = $derived(
	messages.some((message) => message.localState === "sending"),
);

function canManageMessage(message: GuestbookMessage): boolean {
	if (message.localState) return false;
	return Boolean(message.isOwner) || message.isAdmin;
}

function canEditMessage(message: GuestbookMessage): boolean {
	if (message.localState) return false;
	return isAdmin;
}

const memberList = $derived.by(() => {
	const map = new Map<
		string,
		{
			nick: string;
			avatar: string;
			link?: string;
			count: number;
			isAdmin: boolean;
		}
	>();
	for (const m of messages) {
		if (m.localState) continue;
		const key = m.nick || "匿名";
		const existing = map.get(key);
		if (existing) {
			existing.count += 1;
			if (!existing.avatar && m.avatar) existing.avatar = m.avatar;
			existing.isAdmin = existing.isAdmin || m.isAdmin;
		} else {
			map.set(key, {
				nick: m.nick,
				avatar: m.avatar,
				link: m.link,
				count: 1,
				isAdmin: m.isAdmin,
			});
		}
	}
	return [...map.values()].sort((a, b) => b.count - a.count);
});

/** 分组：站长 / 留言人 */
const adminMembers = $derived(memberList.filter((m) => m.isAdmin));
const guestMembers = $derived(memberList.filter((m) => !m.isAdmin));

function toggleMemberSidebar() {
	memberSidebarOpen = !memberSidebarOpen;
}

function openProfileCard(message: GuestbookMessage) {
	profileCardTarget = message;
	profileCardMessageCount =
		memberList.find((m) => m.nick === message.nick)?.count ?? 0;
	void tick().then(() => {
		profileCardDialog?.showModal();
		document.body.style.overflow = "hidden";
	});
}

function closeProfileCard() {
	if (profileCardDialog?.open) profileCardDialog.close();
	profileCardTarget = null;
	document.body.style.overflow = "";
}

function openProfileCardByNick(nick: string) {
	const target = messages.find((m) => m.nick === nick && !m.localState) ?? null;
	if (target) openProfileCard(target);
}

function requestEdit(message: GuestbookMessage) {
	if (!canEditMessage(message)) return;
	editingTarget = message;
	editDraft = message.body.replace(/<[^>]*>/gu, "");
	editError = "";
	void tick().then(() => {
		editDialog?.showModal();
		document.body.style.overflow = "hidden";
	});
}

async function saveEdit() {
	const target = editingTarget;
	if (!target?.id) return;
	const content = editDraft.trim();
	const validation = validateMessageBody(content);
	if (validation) {
		editError = validation;
		return;
	}
	try {
		const html = renderMessageMarkdown(content);
		const result = await apiUpdateComment(target.id, html);
		messages = messages.map((m) =>
			m.id === target.id ? { ...m, body: result.comment || html } : m,
		);
		editDialog?.close();
		document.body.style.overflow = "";
		editingTarget = null;
		editError = "";
		queueLatestSync();
	} catch (error) {
		editError = getErrorMessage(error) || "编辑失败，请稍后重试";
	}
}

function cancelEdit() {
	if (editDialog?.open) editDialog.close();
	editingTarget = null;
	editError = "";
	document.body.style.overflow = "";
}

function openAdminLogin() {
	adminLoginError = "";
	adminPassword = "";
	void tick().then(() => {
		adminDialog?.showModal();
		document.body.style.overflow = "hidden";
	});
}

async function submitAdminLogin() {
	try {
		await loginAdmin(adminPassword);
		isAdmin = true;
		adminDialog?.close();
		document.body.style.overflow = "";
		adminPassword = "";
		queueLatestSync();
	} catch (error) {
		adminLoginError = getErrorMessage(error) || "登录失败，请检查密码";
	}
}

function handleLogoutAdmin() {
	logoutAdmin();
	isAdmin = false;
}

function readStoredValue<T>(storage: Storage, key: string): T | null {
	try {
		const raw = storage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

function readStoredString(storage: Storage, key: string): string {
	try {
		return storage.getItem(key) ?? "";
	} catch {
		return "";
	}
}

function writeStoredValue(storage: Storage, key: string, value: unknown) {
	try {
		storage.setItem(key, JSON.stringify(value));
	} catch {
		// 隐私模式等场景忽略
	}
}

function writeStoredString(storage: Storage, key: string, value: string) {
	try {
		storage.setItem(key, value);
	} catch {
		// ignore
	}
}

function isProfile(value: unknown): value is GuestbookProfile {
	if (!value || typeof value !== "object") return false;
	const storedProfile = value as Partial<GuestbookProfile>;
	return (
		typeof storedProfile.nick === "string" &&
		typeof storedProfile.mail === "string" &&
		typeof storedProfile.link === "string"
	);
}

function finishDataRequest(controller: AbortController) {
	if (dataController !== controller) return;
	dataController = null;
	if (!syncQueued) return;
	syncQueued = false;
	queueMicrotask(() => void syncLatest());
}

function queueLatestSync() {
	if (dataController) {
		syncQueued = true;
		return;
	}
	void syncLatest();
}

async function fetchPage(page: number, _signal?: AbortSignal) {
	return getComments(page, PAGE_SIZE);
}

/**
 * 拉取并应用 Twikoo 服务端配置（头像 CDN 与默认风格）。
 * 必须在 flattenComments 之前完成，否则头像会用兜底值渲染。
 * 拉取失败不阻塞留言加载，此时沿用官方默认值。
 */
async function ensureServerConfig() {
	try {
		const cfg = await getServerConfig();
		setEmotionCdn(cfg.EMOTION_CDN);
		applyServerConfig(cfg);
	} catch {
		// 配置拉取失败：保持默认头像策略，不影响留言展示
	}
}

async function loadInitial() {
	if (isOffline) {
		initialLoading = false;
		initialError = "当前处于离线状态，恢复网络后将自动加载";
		return;
	}
	dataController?.abort();
	const controller = new AbortController();
	dataController = controller;
	syncing = false;
	loadingOlder = false;
	initialLoading = true;
	initialError = "";
	syncError = "";

	try {
		// 并行拉配置与首页数据：配置在 flattenComments 前应用，且不多一轮往返
		const [, response] = await Promise.all([
			ensureServerConfig(),
			fetchPage(1, controller.signal),
		]);
		if (dataController !== controller) return;
		messages = mergeMessages(messages, flattenComments(response.data));
		currentPage = 1;
		totalPages = response.more ? 2 : 1;
		totalCount = response.count;
		lastSyncedAt = Date.now();
		initialLoading = false;
		await tick();
		scrollToBottom(false);
	} catch (error) {
		if (controller.signal.aborted || dataController !== controller) return;
		const message = getErrorMessage(error);
		if (message) {
			if (messages.length > 0) syncError = message;
			else initialError = message;
		}
	} finally {
		if (dataController === controller) {
			initialLoading = false;
			finishDataRequest(controller);
		}
	}
}

async function syncLatest() {
	if (initialError && messages.length === 0) {
		await loadInitial();
		return;
	}
	if (initialLoading || isOffline) return;
	if (dataController) {
		syncQueued = true;
		return;
	}
	const controller = new AbortController();
	dataController = controller;
	syncing = true;
	syncError = "";
	const wasNearBottom = isNearBottom();
	const knownIds = new Set(
		messages
			.filter((message) => !message.localState)
			.map((message) => message.id),
	);

	try {
		const response = await fetchPage(1, controller.signal);
		if (dataController !== controller) return;
		const incoming = flattenComments(response.data);
		const freshCount = incoming.filter(
			(message) => !knownIds.has(message.id),
		).length;
		messages = mergeMessages(messages, incoming);
		totalPages = response.more ? 2 : 1;
		totalCount = response.count;
		lastSyncedAt = Date.now();
		await tick();

		if (freshCount > 0 && wasNearBottom) scrollToBottom(true);
		else if (freshCount > 0) newMessageCount += freshCount;
	} catch (error) {
		if (controller.signal.aborted || dataController !== controller) return;
		const message = getErrorMessage(error);
		if (message) syncError = message;
	} finally {
		if (dataController === controller) {
			syncing = false;
			finishDataRequest(controller);
		}
	}
}

async function loadOlder() {
	if (!hasMore || loadingOlder || !messageList || dataController) return;
	const controller = new AbortController();
	dataController = controller;
	loadingOlder = true;
	const previousHeight = messageList.scrollHeight;
	const nextPage = currentPage + 1;

	try {
		const response = await fetchPage(nextPage, controller.signal);
		if (dataController !== controller) return;
		messages = mergeMessages(messages, flattenComments(response.data));
		currentPage = nextPage;
		totalPages = response.more ? nextPage + 1 : nextPage;
		totalCount = response.count;
		await tick();
		messageList.scrollTop += messageList.scrollHeight - previousHeight;
	} catch (error) {
		if (controller.signal.aborted || dataController !== controller) return;
		const message = getErrorMessage(error);
		if (message) syncError = message;
	} finally {
		if (dataController === controller) {
			loadingOlder = false;
			finishDataRequest(controller);
		}
	}
}

function startPolling() {
	if (pollTimer) window.clearInterval(pollTimer);
	pollTimer = undefined;
	if (document.visibilityState !== "visible" || !navigator.onLine) return;
	pollTimer = window.setInterval(() => {
		if (document.visibilityState === "visible" && navigator.onLine) {
			void syncLatest();
		}
	}, POLL_INTERVAL);
}

function handleVisibilityChange() {
	if (document.visibilityState === "visible") {
		queueLatestSync();
		startPolling();
		return;
	}
	if (pollTimer) window.clearInterval(pollTimer);
	pollTimer = undefined;
}

function handleOnline() {
	isOffline = false;
	queueLatestSync();
	startPolling();
}

function handleOffline() {
	isOffline = true;
	syncError = "网络已断开，恢复连接后将自动同步";
	if (pollTimer) window.clearInterval(pollTimer);
	pollTimer = undefined;
	dataController?.abort();
}

function isNearBottom(): boolean {
	if (!messageList) return true;
	return (
		messageList.scrollHeight -
			messageList.scrollTop -
			messageList.clientHeight <
		120
	);
}

function scrollToBottom(smooth = true) {
	if (!messageList) return;
	const reduceMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	messageList.scrollTo({
		top: messageList.scrollHeight,
		behavior: smooth && !reduceMotion ? "smooth" : "auto",
	});
	newMessageCount = 0;
	showScrollToBottom = false;
}

function handleMessageScroll() {
	if (!messageList) return;
	if (messageList.scrollTop < 72 && hasMore) void loadOlder();
	const nearBottom = isNearBottom();
	showScrollToBottom = !nearBottom;
	if (nearBottom) newMessageCount = 0;
}

function formatMessageTimeValue(value: number): string {
	return formatMessageTime(value);
}

function formatSyncStatus(): string {
	if (isOffline) return "离线";
	if (syncing) return "同步中";
	if (syncError) return "同步失败";
	if (!lastSyncedAt) return "等待同步";
	return `同步于 ${new Intl.DateTimeFormat("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).format(lastSyncedAt)}`;
}

function selectReply(message: GuestbookMessage) {
	if (!message.localState) replyTarget = message;
}

async function jumpToQuotedMessage(message: GuestbookMessage) {
	if (!message.replyToId) return;
	let target = messages.find((candidate) => candidate.id === message.replyToId);

	while (!target && hasMore && !loadingOlder) {
		await loadOlder();
		target = messages.find((candidate) => candidate.id === message.replyToId);
	}

	const element = document.getElementById(
		`guestbook-message-${message.replyToId}`,
	);
	if (!element) return;
	const reduceMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	element.scrollIntoView({
		behavior: reduceMotion ? "auto" : "smooth",
		block: "center",
	});
	element.classList.remove("is-highlighted");
	requestAnimationFrame(() => element.classList.add("is-highlighted"));
	window.setTimeout(() => element.classList.remove("is-highlighted"), 1600);
}

function validateComposer(content: string): string {
	if (profile.nick.trim().length < 2) {
		return "请先填写昵称（游客访问）后再发送";
	}
	if (profile.mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(profile.mail)) {
		return "邮箱格式不正确";
	}
	if (profile.link) {
		try {
			const website = new URL(profile.link);
			if (website.protocol !== "http:" && website.protocol !== "https:") {
				return "网站地址仅支持 http 或 https";
			}
		} catch {
			return "网站地址格式不正确";
		}
	}
	return validateMessageBody(content);
}

async function sendMessage(
	replaceMessageId?: string,
	contentOverride?: string,
): Promise<boolean> {
	if (isSending || isOffline) return false;
	const content = contentOverride ?? draft.trim();
	composerError = validateComposer(content);
	if (composerError) return false;

	const selectedTarget = replyTarget;
	const target = selectedTarget?.id ? selectedTarget : null;
	const tempId = `local-${Date.now()}`;
	const html = renderMessageMarkdown(content);
	const optimistic: GuestbookMessage = {
		id: tempId,
		nick: profile.nick.trim(),
		avatar: "",
		link: profile.link.trim() || undefined,
		body: html,
		createdAt: Date.now(),
		isAdmin: false,
		isOwner: true,
		replyToId: target?.id,
		replyToNick: target?.nick,
		localState: "sending",
	};

	const retainedMessages = replaceMessageId
		? messages.filter((message) => message.id !== replaceMessageId)
		: messages;
	messages = [...retainedMessages, optimistic];
	draft = "";
	replyTarget = null;
	await tick();
	scrollToBottom(true);

	try {
		const response = await submitComment({
			nick: profile.nick.trim(),
			mail: profile.mail.trim() || undefined,
			link: profile.link.trim() || undefined,
			comment: html,
			pid: target?.id,
			rid: target?.id,
		});

		const confirmed = mergeMessages(
			messages.filter((message) => message.id !== tempId),
			[
				{
					...optimistic,
					id: response.id || tempId,
					localState: undefined,
					body: response.comment || html,
					isAdmin: Boolean(response.master),
					createdAt: response.created || Date.now(),
					avatar: response.avatar || optimistic.avatar,
				},
			],
		);
		messages = confirmed;
		totalCount += 1;
		initialError = "";
		syncError = "";
		lastSyncedAt = Date.now();
		await tick();
		scrollToBottom(true);
		queueLatestSync();
	} catch (error) {
		const failureReason = getErrorMessage(error) || "消息发送失败";
		messages = messages.map((message) =>
			message.id === tempId
				? { ...message, localState: "failed", failureReason }
				: message,
		);
	}
	return true;
}

async function retryMessage(message: GuestbookMessage) {
	const target = message.replyToId
		? (messages.find((candidate) => candidate.id === message.replyToId) ?? null)
		: null;
	replyTarget = target;
	const text = message.body.replace(/<[^>]*>/gu, "").trim();
	await sendMessage(message.id, text);
}

function discardMessage(message: GuestbookMessage) {
	messages = messages.filter((candidate) => candidate.id !== message.id);
}

function closeDeleteDialog() {
	if (mutatingMessageId === deleteTarget?.id) return;
	if (deleteDialog?.open) deleteDialog.close();
	deleteTarget = null;
	document.body.style.overflow = "";
}

function requestDeleteMessage(message: GuestbookMessage) {
	if (!canManageMessage(message)) return;
	messageActionError = null;
	deleteTarget = message;
	void tick().then(() => {
		if (!deleteDialog?.open) deleteDialog?.showModal();
		document.body.style.overflow = "hidden";
	});
}

async function confirmDeleteMessage() {
	const target = deleteTarget;
	if (!target?.id || !canManageMessage(target) || mutatingMessageId) {
		return;
	}

	mutatingMessageId = target.id;
	messageActionError = null;
	try {
		await apiDeleteComment(target.id);
		messages = messages.filter((message) => message.id !== target.id);
		totalCount = Math.max(0, totalCount - 1);
		if (replyTarget?.id === target.id) replyTarget = null;
		mutatingMessageId = null;
		deleteTarget = null;
		if (deleteDialog?.open) deleteDialog.close();
		document.body.style.overflow = "";
		queueLatestSync();
	} catch (error) {
		messageActionError = {
			id: target.id,
			message: getErrorMessage(error) || "消息删除失败，请稍后重试",
		};
		mutatingMessageId = null;
	}
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	return "";
}

const ANNOUNCEMENT_BAR_KEY = "guestbook-announcement-bar-dismissed";
const ANNOUNCEMENT_DIALOG_KEY_PREFIX = "guestbook-announcement-dialog-shown-";

async function openAnnouncement(
	item: typeof selectedAnnouncement extends infer T ? T : never,
) {
	selectedAnnouncement = item;
	await tick();
	if (!announcementDialog?.open) announcementDialog?.showModal();
	document.body.style.overflow = "hidden";
}

function closeAnnouncement() {
	if (announcementDialog?.open) announcementDialog.close();
	document.body.style.overflow = "";
}

function dismissAnnouncementBar() {
	announcementBarVisible = false;
	try {
		localStorage.setItem(ANNOUNCEMENT_BAR_KEY, "1");
	} catch {}
}

function hasSeenAnnouncementDialog(id: string): boolean {
	try {
		return localStorage.getItem(ANNOUNCEMENT_DIALOG_KEY_PREFIX + id) === "1";
	} catch {
		return false;
	}
}

function markAnnouncementDialogSeen(id: string) {
	try {
		localStorage.setItem(ANNOUNCEMENT_DIALOG_KEY_PREFIX + id, "1");
	} catch {}
}

function closeAnnouncementDialogAndMarkSeen() {
	if (selectedAnnouncement) {
		markAnnouncementDialogSeen(selectedAnnouncement.id);
	}
	closeAnnouncement();
}

function handleProfileChange(nextProfile: GuestbookProfile) {
	profile = nextProfile;
	writeStoredValue(localStorage, PROFILE_STORAGE_KEY, nextProfile);
	composerError = "";
}

function handleDraftChange(nextDraft: string) {
	draft = nextDraft;
	writeStoredString(localStorage, DRAFT_STORAGE_KEY, nextDraft);
	composerError = "";
}

function handleCopyError(errorText: string) {
	composerError = errorText;
}

/** 全屏模式：仅留言板页面给 #main-grid 加标记，隐藏博客侧边栏 */
function applyFullscreenClass() {
	const grid = document.getElementById("main-grid");
	if (!grid) return;
	if (document.querySelector(".guestbook-fullscreen")) {
		grid.classList.add("guestbook-page-active");
	} else {
		grid.classList.remove("guestbook-page-active");
	}
}

onMount(() => {
	const storedProfile = readStoredValue<unknown>(
		localStorage,
		PROFILE_STORAGE_KEY,
	);
	if (isProfile(storedProfile)) profile = storedProfile;
	draft = readStoredString(localStorage, DRAFT_STORAGE_KEY);
	isOffline = !navigator.onLine;

	// 进入留言板页：标记全屏（隐藏侧边栏）
	applyFullscreenClass();
	document.addEventListener("swup:page:view", applyFullscreenClass);

	// 公告栏：恢复关闭状态；首次访问自动弹出第一条公告
	try {
		if (localStorage.getItem(ANNOUNCEMENT_BAR_KEY) === "1") {
			announcementBarVisible = false;
		}
	} catch {}
	const firstAnnouncement = guestbookConfig.announcements[0];
	if (firstAnnouncement && !hasSeenAnnouncementDialog(firstAnnouncement.id)) {
		void tick().then(() => void openAnnouncement(firstAnnouncement));
	}

	// 后台预加载表情库：先取服务端 EMOTION_CDN 再预热缓存，
	// 保证历史留言里的 :key: 与评论区用同一份 owo 渲染。
	// 同时在此统一判定 SHOW_EMOTION 并下发到输入框（emojiEnabled），
	// 与图片按钮共用同一次配置请求，确保表情按钮和图片按钮同时出现。
	void getServerConfig()
		.then((cfg) => {
			setEmotionCdn(cfg.EMOTION_CDN);
			emojiEnabled = cfg.SHOW_EMOTION === "true";
		})
		.then(() => loadEmojiPacks())
		.catch(() => {});

	void loadInitial();
	startPolling();
	document.addEventListener("visibilitychange", handleVisibilityChange);
	window.addEventListener("online", handleOnline);
	window.addEventListener("offline", handleOffline);

	return () => {
		if (pollTimer) window.clearInterval(pollTimer);
		dataController?.abort();
		if (deleteDialog?.open) deleteDialog.close();
		document.body.style.overflow = "";
		document.removeEventListener("visibilitychange", handleVisibilityChange);
		document.removeEventListener("swup:page:view", applyFullscreenClass);
		window.removeEventListener("online", handleOnline);
		window.removeEventListener("offline", handleOffline);
		// 离开留言板页：移除全屏标记，恢复其他页面的侧边栏
		const grid = document.getElementById("main-grid");
		grid?.classList.remove("guestbook-page-active");
	};
});
</script>

<section class="guestbook-chat" aria-label="留言板">
	<header class="guestbook-chat__header">
		<div class="guestbook-chat__channel">
			<div>
				<div class="guestbook-chat__title-row">
					<h2>留言板</h2>
					<span>· {initialLoading ? "--" : totalCount} 条留言</span>
					<div class="guestbook-chat__sync">
						<div
							class:is-failed={Boolean(syncError)}
							class="guestbook-chat__status"
							aria-live="polite"
						>
							<span class:is-offline={isOffline}></span>
							{formatSyncStatus()} · 30 s
						</div>
						<button
							class:is-syncing={syncing}
							class="guestbook-chat__refresh"
							type="button"
							onclick={() => void syncLatest()}
							disabled={syncing || initialLoading || isOffline}
							aria-label="立即刷新消息"
							title="立即刷新"
						>
							<Icon icon="lucide:refresh-cw" width={17} height={17} />
						</button>
						<span class="guestbook-chat__header-divider" aria-hidden="true"></span>
						<button
							class:is-active={memberSidebarOpen}
							class="guestbook-chat__refresh"
							type="button"
							onclick={toggleMemberSidebar}
							aria-label="成员列表"
							title="成员列表"
						>
							<Icon icon="lucide:users" width={17} height={17} />
						</button>
						{#if isAdmin}
							<button
								class="guestbook-chat__refresh"
								type="button"
								onclick={handleLogoutAdmin}
								aria-label="退出站长登录"
								title="退出站长登录"
							>
								<Icon icon="lucide:shield-check" width={17} height={17} />
							</button>
						{:else}
							<button
								class="guestbook-chat__refresh"
								type="button"
								onclick={openAdminLogin}
								aria-label="站长登录"
								title="站长登录"
							>
								<Icon icon="lucide:shield" width={17} height={17} />
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</header>

	<div
		class:has-announcement-bar={announcementBarVisible && guestbookConfig.announcements.length > 0}
		class:has-sidebar={memberSidebarOpen}
		class="guestbook-chat__workspace"
	>
		{#if announcementBarVisible && guestbookConfig.announcements.length > 0}
			<aside class="guestbook-chat__announcement-bar" aria-label="公告">
				<div class="guestbook-chat__announcement-bar-label">
					<Icon icon="lucide:bell" width={16} height={16} />
					<strong>公告</strong>
				</div>
				<div class="guestbook-chat__announcement-bar-items">
					{#each guestbookConfig.announcements as item}
						<button type="button" onclick={() => void openAnnouncement(item)}>
							{item.title}
						</button>
					{/each}
				</div>
				<button
					class="guestbook-chat__announcement-bar-close"
					type="button"
					onclick={dismissAnnouncementBar}
					aria-label="关闭公告栏"
					title="关闭公告栏"
				>
					<Icon icon="lucide:x" width={17} height={17} />
				</button>
			</aside>
		{/if}
		<div class="guestbook-chat__conversation">
			{#if initialLoading}
				<div class="guestbook-chat__loading" aria-label="正在加载留言" aria-busy="true">
					{#each Array(6) as _, index}
						<div class:is-admin={index % 3 === 2} class="guestbook-chat__skeleton">
							<div class="guestbook-chat__skeleton-avatar"></div>
							<div class="guestbook-chat__skeleton-copy">
								<div class="guestbook-chat__skeleton-name"></div>
								<div class="guestbook-chat__skeleton-bubble"></div>
								<div class="guestbook-chat__skeleton-meta"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if initialError && messages.length === 0}
				<div class="guestbook-chat__state" role="alert">
					<Icon icon="lucide:alert-circle" width={34} height={34} />
					<h3>留言板加载失败</h3>
					<p>{initialError}</p>
					<button type="button" onclick={() => void loadInitial()}>
						<Icon icon="lucide:rotate-ccw" width={17} height={17} />重新加载
					</button>
				</div>
			{:else}
				<div
					class="guestbook-chat__messages custom-scrollbar"
					bind:this={messageList}
					onscroll={handleMessageScroll}
					aria-live="polite"
					aria-relevant="additions"
				>
					<div class="guestbook-chat__history">
						{#if hasMore}
							<button
								type="button"
								onclick={() => void loadOlder()}
								disabled={loadingOlder}
							>
								{#if loadingOlder}
									<Icon
										icon="lucide:loader-circle"
										class="is-spinning"
										width={15}
										height={15}
									/>
								{/if}
								{loadingOlder ? "正在加载历史消息" : "加载更早消息"}
							</button>
						{:else if messages.length > 0}
							<span>已经到最早一条消息</span>
						{/if}
					</div>

					{#if messages.length === 0}
						<div class="guestbook-chat__empty">
							<div class="guestbook-chat__empty-mark">GB</div>
							<h3>还没有人发言</h3>
							<p>发送第一条消息，开启这段对话。</p>
						</div>
					{/if}

					{#each messages as message, index (message.id)}
						{#if shouldShowDate(index, messages)}
							<div class="guestbook-chat__date">
								<span>{dateLabel(message.createdAt)}</span>
							</div>
						{/if}

						<GuestbookChatMessage
							{message}
							referencedMessage={message.replyToId
								? messages.find((candidate) => candidate.id === message.replyToId)
								: undefined}
							timeLabel={formatMessageTimeValue(message.createdAt)}
							canManage={canManageMessage(message)}
							onReply={selectReply}
							onDelete={requestDeleteMessage}
							onJump={(target) => void jumpToQuotedMessage(target)}
							onRetry={(target) => void retryMessage(target)}
							onDiscard={discardMessage}
							onCopyError={handleCopyError}
							onShowProfile={openProfileCard}
							onEdit={requestEdit}
							canEdit={canEditMessage(message)}
						/>
					{/each}
				</div>
			{/if}

			<div class="guestbook-chat__composer-area">
				{#if !initialLoading && !initialError && (showScrollToBottom || newMessageCount > 0)}
					<button
						class="guestbook-chat__new-messages"
						type="button"
						onclick={() => scrollToBottom(true)}
						aria-label={newMessageCount > 0
							? `${newMessageCount} 条新消息，回到最新消息`
							: "回到底部"}
					>
						<Icon icon="lucide:chevron-down" width={20} height={20} />
					</button>
				{/if}

				{#if syncError || isOffline}
					<div class="guestbook-chat__sync-error" role="status">
						<Icon icon="lucide:wifi-off" width={15} height={15} />
						<span>{syncError || "当前处于离线状态"}</span>
						{#if !isOffline}
							<button type="button" onclick={() => void syncLatest()}>重试同步</button>
						{/if}
					</div>
				{/if}

				<GuestbookChatComposer
					{profile}
					{draft}
					{replyTarget}
					{composerError}
					{isOffline}
					{isSending}
					emojiEnabled={emojiEnabled}
					onProfileChange={handleProfileChange}
					onDraftChange={handleDraftChange}
					onReplyCancel={() => (replyTarget = null)}
					onSend={(content) => sendMessage(undefined, content)}
					onToolError={(message) => (composerError = message)}
				/>
			</div>
		</div>
		{#if memberSidebarOpen}
			<aside class="guestbook-chat__sidebar" aria-label="成员列表">
				{#if adminMembers.length > 0}
					<div class="guestbook-chat__sidebar-section">
						<span>站长</span>
						<span>— {adminMembers.length}</span>
					</div>
					<ul class="guestbook-chat__sidebar-list">
						{#each adminMembers as member (member.nick)}
							<li class="guestbook-chat__sidebar-item">
								<button
									type="button"
									class="guestbook-chat__sidebar-user"
									data-role="admin"
									onclick={() => openProfileCardByNick(member.nick)}
								>
									<span class="guestbook-chat__sidebar-avatar">
										{#if member.avatar}
											<img
												src={member.avatar}
												alt=""
												loading="lazy"
												referrerpolicy="no-referrer"
												onerror={(event) => {
													(event.currentTarget as HTMLImageElement).style.display = "none";
												}}
											/>
										{:else}
											{member.nick.slice(0, 1)}
										{/if}
									</span>
									<span class="guestbook-chat__sidebar-name">{member.nick}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				{#if guestMembers.length > 0}
					<div class="guestbook-chat__sidebar-section">
						<span>留言人</span>
						<span>— {guestMembers.length}</span>
					</div>
					<ul class="guestbook-chat__sidebar-list">
						{#each guestMembers as member (member.nick)}
							<li class="guestbook-chat__sidebar-item">
								<button
									type="button"
									class="guestbook-chat__sidebar-user"
									onclick={() => openProfileCardByNick(member.nick)}
								>
									<span class="guestbook-chat__sidebar-avatar">
										{#if member.avatar}
											<img
												src={member.avatar}
												alt=""
												loading="lazy"
												referrerpolicy="no-referrer"
												onerror={(event) => {
													(event.currentTarget as HTMLImageElement).style.display = "none";
												}}
											/>
										{:else}
											{member.nick.slice(0, 1)}
										{/if}
									</span>
									<span class="guestbook-chat__sidebar-name">{member.nick}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</aside>
		{/if}
	</div>

	{#if guestbookConfig.announcements.length > 0}
		<dialog
			bind:this={announcementDialog}
			class="guestbook-modal guestbook-announcement-modal"
			aria-labelledby="guestbook-announcement-title"
			onclose={() => {
				document.body.style.overflow = "";
			}}
			oncancel={(event) => {
				event.preventDefault();
				closeAnnouncementDialogAndMarkSeen();
			}}
		>
			<div class="guestbook-modal__overlay" onclick={closeAnnouncementDialogAndMarkSeen}></div>
			{#if selectedAnnouncement}
				<div class="guestbook-modal__panel guestbook-announcement-modal__panel">
					<div class="guestbook-modal__header">
						<h2 id="guestbook-announcement-title" class="guestbook-modal__title">
							{selectedAnnouncement.title}
						</h2>
						<button
							class="guestbook-modal__close"
							type="button"
							onclick={closeAnnouncementDialogAndMarkSeen}
							aria-label="关闭公告"
						>
							<Icon icon="lucide:x" width={20} height={20} />
						</button>
					</div>
					<div class="guestbook-modal__body guestbook-announcement-modal__body">
						<p>{selectedAnnouncement.summary}</p>
						{#if selectedAnnouncement.lead}
							<p>{selectedAnnouncement.lead}</p>
						{/if}
						{#if selectedAnnouncement.rules && selectedAnnouncement.rules.length > 0}
							<ul>
								{#each selectedAnnouncement.rules as rule}
									<li>{rule}</li>
								{/each}
							</ul>
						{/if}
					</div>
					<div class="guestbook-modal__footer">
						<button class="guestbook-modal__confirm" type="button" onclick={closeAnnouncementDialogAndMarkSeen}>
							我知道了
						</button>
					</div>
				</div>
			{/if}
		</dialog>
	{/if}

	<dialog
		bind:this={deleteDialog}
		class="guestbook-modal guestbook-delete-modal"
		aria-labelledby="guestbook-delete-title"
		onclose={() => {
			document.body.style.overflow = "";
			if (!mutatingMessageId) deleteTarget = null;
		}}
		oncancel={(event) => {
			event.preventDefault();
			closeDeleteDialog();
		}}
	>
		<div class="guestbook-modal__overlay" onclick={closeDeleteDialog}></div>
		{#if deleteTarget}
			<div class="guestbook-modal__panel guestbook-delete-modal__panel">
				<div class="guestbook-modal__header">
					<h2 id="guestbook-delete-title">删除消息</h2>
					<button
						class="guestbook-modal__close"
						type="button"
						onclick={closeDeleteDialog}
						disabled={mutatingMessageId === deleteTarget.id}
						aria-label="关闭删除确认"
					>
						<Icon icon="lucide:x" width={20} height={20} />
					</button>
				</div>
				<div class="guestbook-modal__body guestbook-delete-modal__body">
					<p>删除后无法恢复，Twikoo 服务端也会同步删除这条消息。</p>
					<blockquote>{deleteTarget.body.replace(/<[^>]*>/gu, "").slice(0, 160)}</blockquote>
					{#if messageActionError?.id === deleteTarget.id}
						<p class="guestbook-delete-modal__error" role="alert">
							{messageActionError.message}
						</p>
					{/if}
				</div>
				<div class="guestbook-modal__footer guestbook-delete-modal__actions">
					<button
						class="guestbook-delete-modal__cancel"
						type="button"
						onclick={closeDeleteDialog}
						disabled={mutatingMessageId === deleteTarget.id}
					>
						取消
					</button>
					<button
						class="guestbook-delete-modal__confirm"
						type="button"
						onclick={() => void confirmDeleteMessage()}
						disabled={mutatingMessageId === deleteTarget.id}
					>
						{mutatingMessageId === deleteTarget.id ? "删除中" : "确认删除"}
					</button>
				</div>
			</div>
		{/if}
	</dialog>

	<!-- 访客资料卡 -->
	<dialog bind:this={profileCardDialog} class="guestbook-modal guestbook-profilecard-modal" onclose={closeProfileCard}>
		<div class="guestbook-modal__overlay" onclick={closeProfileCard}></div>
		{#if profileCardTarget}
			<div class="guestbook-modal__panel">
				<div class="guestbook-modal__header">
					<h2>访客资料</h2>
					<button type="button" class="guestbook-modal__close" onclick={closeProfileCard} aria-label="关闭">
						<Icon icon="lucide:x" width={18} height={18} />
					</button>
				</div>
				<div class="guestbook-modal__body guestbook-profilecard-modal__body">
					<div class="guestbook-profilecard-modal__hero">
						<span class="guestbook-profilecard-modal__avatar">
							{#if profileCardTarget.avatar}
								<img
									src={profileCardTarget.avatar}
									alt=""
									loading="lazy"
									referrerpolicy="no-referrer"
									onerror={(event) => {
										(event.currentTarget as HTMLImageElement).style.display = "none";
									}}
								/>
							{:else}
								{profileCardTarget.nick.slice(0, 1)}
							{/if}
						</span>
						<div class="guestbook-profilecard-modal__hero-info">
							<strong>{profileCardTarget.nick}</strong>
							{#if profileCardTarget.isAdmin}
								<span class="guestbook-message__badge guestbook-message__badge--admin">站长</span>
							{/if}
							<div class="guestbook-profilecard-modal__count">{profileCardMessageCount} 条留言</div>
						</div>
					</div>
					<dl class="guestbook-profilecard-modal__meta">
						{#if profileCardTarget.link}
							<div>
								<dt>网站</dt>
								<dd><a href={profileCardTarget.link} target="_blank" rel="nofollow noopener noreferrer">{profileCardTarget.link}</a></dd>
							</div>
						{/if}
						{#if profileCardTarget.addr}
							<div><dt>属地</dt><dd>{profileCardTarget.addr}</dd></div>
						{/if}
						{#if profileCardTarget.browser}
							<div><dt>浏览器</dt><dd>{profileCardTarget.browser}</dd></div>
						{/if}
						{#if profileCardTarget.os}
							<div><dt>系统</dt><dd>{profileCardTarget.os}</dd></div>
						{/if}
					</dl>
				</div>
				<div class="guestbook-modal__footer">
					<button type="button" class="guestbook-modal__confirm" onclick={closeProfileCard}>关闭</button>
				</div>
			</div>
		{/if}
	</dialog>

	<!-- 编辑消息 -->
	<dialog bind:this={editDialog} class="guestbook-modal guestbook-edit-modal" onclose={cancelEdit}>
		<div class="guestbook-modal__overlay" onclick={cancelEdit}></div>
		<form method="dialog" class="guestbook-modal__panel" onsubmit={(event) => { event.preventDefault(); void saveEdit(); }}>
			<div class="guestbook-modal__header">
				<h2>编辑消息</h2>
				<button type="button" class="guestbook-modal__close" onclick={cancelEdit} aria-label="关闭">
					<Icon icon="lucide:x" width={18} height={18} />
				</button>
			</div>
			<div class="guestbook-modal__body">
				<textarea class="guestbook-edit-modal__textarea" bind:value={editDraft} placeholder="修改留言内容…"></textarea>
				{#if editError}
					<p class="guestbook-delete-modal__error">{editError}</p>
				{/if}
			</div>
			<div class="guestbook-modal__footer">
				<button type="button" onclick={cancelEdit}>取消</button>
				<button type="submit" class="guestbook-modal__confirm">保存</button>
			</div>
		</form>
	</dialog>

	<!-- 站长登录 -->
	<dialog bind:this={adminDialog} class="guestbook-modal guestbook-admin-modal" onclose={() => (document.body.style.overflow = "")}>
		<div class="guestbook-modal__overlay" onclick={() => adminDialog?.close()}></div>
		<form method="dialog" class="guestbook-modal__panel" onsubmit={(event) => { event.preventDefault(); void submitAdminLogin(); }}>
			<div class="guestbook-modal__header">
				<h2>站长登录</h2>
				<button type="button" class="guestbook-modal__close" onclick={() => adminDialog?.close()} aria-label="关闭">
					<Icon icon="lucide:x" width={18} height={18} />
				</button>
			</div>
			<div class="guestbook-modal__body guestbook-admin-modal__body">
				<p class="guestbook-admin-modal__hint">输入 Twikoo 站长密码，以编辑 / 管理留言。</p>
				<input
					type="password"
					class="guestbook-admin-modal__input"
					bind:value={adminPassword}
					placeholder="站长密码"
					autocomplete="current-password"
				/>
				{#if adminLoginError}
					<p class="guestbook-delete-modal__error">{adminLoginError}</p>
				{/if}
			</div>
			<div class="guestbook-modal__footer">
				<button type="button" onclick={() => adminDialog?.close()}>取消</button>
				<button type="submit" class="guestbook-modal__confirm">登录</button>
			</div>
		</form>
	</dialog>
</section>
