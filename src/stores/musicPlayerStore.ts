import Key from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

import {
	DEFAULT_SONG,
	LOCAL_PLAYLIST,
	SKIP_ERROR_DELAY,
	STORAGE_KEY_VOLUME,
} from "@/components/widgets/music-player/constants";
import type {
	PlayerMode,
	RepeatMode,
	Song,
} from "@/components/widgets/music-player/types";
import { musicPlayerConfig } from "@/config";

export interface LyricLine {
	time: number;
	text: string;
}

interface ResumeSnapshot {
	id?: number;
	url: string;
	title: string;
	artist: string;
	cover: string;
	lrc?: string;
	currentTime: number;
	isPlaying: boolean;
	mode: PlayerMode;
	cloudPlaylistId: string;
}

export interface MusicPlayerState {
	currentSong: Song;
	playlist: Song[];
	currentIndex: number;
	isPlaying: boolean;
	isLoading: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	isMuted: boolean;
	isShuffled: boolean;
	isRepeating: RepeatMode;
	showPlaylist: boolean;
	errorMessage: string;
	showError: boolean;
	isExpanded: boolean;
	isHidden: boolean;
	autoplayFailed: boolean;
	willAutoPlay: boolean;
	mode: PlayerMode;
	cloudPlaylistId: string;
	localPlaylist: Song[];
	lyrics: LyricLine[];
	currentLrcIndex: number;
}

const STORAGE_KEY_MODE = "music-player-mode";
const STORAGE_KEY_CLOUD_PLAYLIST_ID = "music-player-cloud-playlist-id";
const STORAGE_KEY_RESUME = "music-player-resume";

const FALLBACK_METING_APIS = [
	"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
	"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
];

function getAssetPath(path: string): string {
	if (!path) {
		return "";
	}
	if (path.startsWith("http://") || path.startsWith("https://")) {
		return path;
	}
	if (path.startsWith("/")) {
		return path;
	}
	return `/${path}`;
}

function formatTime(seconds: number): string {
	if (!seconds || Number.isNaN(seconds)) return "0:00";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

function parseLRC(lrc: string): LyricLine[] {
	if (!lrc) return [];
	const lines = lrc.split("\n");
	const result: LyricLine[] = [];
	const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
	for (const line of lines) {
		const matches = Array.from(line.matchAll(timeReg));
		if (matches.length > 0) {
			const text = line.replace(timeReg, "").trim();
			if (text) {
				for (const match of matches) {
					const m = Number.parseInt(match[1], 10);
					const s = Number.parseInt(match[2], 10);
					const ms = Number.parseInt(match[3], 10);
					const time = m * 60 + s + ms / (match[3].length === 3 ? 1000 : 100);
					result.push({ time, text });
				}
			}
		}
	}
	return result.sort((a, b) => a.time - b.time);
}

class MusicPlayerStore {
	private audio: HTMLAudioElement | null = null;
	private state: MusicPlayerState;
	private isInitialized = false;
	private unregisterInteraction: (() => void) | undefined;
	private listeners = new Set<(state: MusicPlayerState) => void>();
	private pendingSeekTime = 0;
	private lastPersistTime = 0;
	private persistOnUnload = (): void => {
		this.persistResume();
	};

	constructor() {
		this.state = this.createInitialState();
	}

	private createInitialState(): MusicPlayerState {
		// 默认本地歌单：不再读取 localStorage 里遗留的 music-player-mode，
		// 避免老访客加载页面时仍触发网易云 API。在线模式仅能通过 3D 页
		// "切换歌单"手动输入歌单 ID 进入（本次会话内生效，刷新后回本地默认）。
		const configMode = musicPlayerConfig.mode ?? "local";
		const initialMode: PlayerMode = configMode === "local" ? "local" : "online";

		const defaultCloudId = musicPlayerConfig.id ?? "";
		const savedCloudId =
			typeof localStorage !== "undefined"
				? localStorage.getItem(STORAGE_KEY_CLOUD_PLAYLIST_ID)
				: null;

		return {
			currentSong: { ...DEFAULT_SONG },
			playlist: [],
			currentIndex: 0,
			isPlaying: false,
			isLoading: false,
			currentTime: 0,
			duration: 0,
			volume: 0.7,
			isMuted: false,
			isShuffled: false,
			isRepeating: 0,
			showPlaylist: false,
			errorMessage: "",
			showError: false,
			isExpanded: false,
			isHidden: false,
			autoplayFailed: false,
			willAutoPlay: false,
			mode: initialMode,
			cloudPlaylistId: savedCloudId || defaultCloudId,
			localPlaylist: [...LOCAL_PLAYLIST],
			lyrics: [],
			currentLrcIndex: -1,
		};
	}

	private createSnapshot(): MusicPlayerState {
		return {
			...this.state,
			currentSong: { ...this.state.currentSong },
			playlist: this.state.playlist.map((song) => ({ ...song })),
			localPlaylist: this.state.localPlaylist.map((song) => ({ ...song })),
			lyrics: [...this.state.lyrics],
		};
	}

	getState(): MusicPlayerState {
		return this.createSnapshot();
	}

	getAudio(): HTMLAudioElement | null {
		return this.audio;
	}

	getCurrentTrack(): Song {
		return { ...this.state.currentSong };
	}

	getFormatTime(): { currentTimeStr: string; durationStr: string } {
		return {
			currentTimeStr: formatTime(this.state.currentTime),
			durationStr: formatTime(this.state.duration),
		};
	}

	subscribe(listener: (state: MusicPlayerState) => void): () => void {
		this.listeners.add(listener);
		listener(this.createSnapshot());
		return () => {
			this.listeners.delete(listener);
		};
	}

	async initialize(): Promise<void> {
		if (typeof window === "undefined" || this.isInitialized) {
			return;
		}
		this.isInitialized = true;

		if (!musicPlayerConfig.enable) {
			return;
		}

		this.audio = new Audio();
		this.audio.crossOrigin = "anonymous";
		this.setupAudioListeners();
		this.loadVolumeFromStorage();
		// 清理遗留的 mode 记录：默认永远本地歌单；在线仅能通过 3D 页手动切换（刷新即回本地）
		if (typeof localStorage !== "undefined") {
			localStorage.removeItem(STORAGE_KEY_MODE);
		}
		this.registerInteractionHandler();
		if (typeof window !== "undefined") {
			window.addEventListener("beforeunload", this.persistOnUnload);
		}
		// 先捕获断点快照再加载歌单：loadSong() 内部会 persistResume() 覆盖快照，
		// 若先加载歌单会把快照冲成"歌单第一首"，导致刷新/跳转后永远回第一首。
		const resumeRaw =
			typeof sessionStorage !== "undefined"
				? sessionStorage.getItem(STORAGE_KEY_RESUME)
				: null;
		await this.loadPlaylist();
		// 全页刷新 / 路由跳转后，按持久化快照接力同一首歌并续播
		this.applyResumeIfAny(resumeRaw);
		this.broadcastState();
	}

	private setupAudioListeners(): void {
		if (!this.audio) {
			return;
		}

		this.audio.volume = this.state.volume;
		this.audio.muted = this.state.isMuted;

		this.audio.addEventListener("play", () => {
			this.state.isPlaying = true;
			this.persistResume();
			this.broadcastState();
		});

		this.audio.addEventListener("pause", () => {
			this.state.isPlaying = false;
			this.persistResume();
			this.broadcastState();
		});

		this.audio.addEventListener("timeupdate", () => {
			if (this.audio) {
				this.state.currentTime = this.audio.currentTime;
				this.updateLyricsIndex(this.state.currentTime);
				const now = Date.now();
				if (now - this.lastPersistTime > 1000) {
					this.lastPersistTime = now;
					this.persistResume();
				}
				this.broadcastState();
			}
		});

		this.audio.addEventListener("ended", () => {
			this.handleAudioEnded();
		});

		this.audio.addEventListener("error", () => {
			this.handleAudioError();
		});

		this.audio.addEventListener("loadedmetadata", () => {
			if (this.pendingSeekTime && this.audio) {
				try {
					if (this.audio.seekable && this.audio.seekable.length > 0) {
						this.audio.currentTime = this.pendingSeekTime;
					}
				} catch {
					// ignore seek errors
				}
				this.state.currentTime = this.audio.currentTime;
				this.pendingSeekTime = 0;
				this.broadcastState();
			}
		});

		this.audio.addEventListener("loadeddata", () => {
			this.handleAudioLoaded();
		});

		this.audio.addEventListener("loadstart", () => {
			this.state.isLoading = true;
			this.broadcastState();
		});
	}

	private handleAudioEnded(): void {
		if (this.state.isRepeating === 1) {
			if (this.audio) {
				this.audio.currentTime = 0;
				this.audio.play().catch(() => {});
			}
			this.broadcastState();
		} else {
			this.next(true);
		}
	}

	private handleAudioError(): void {
		this.state.isLoading = false;
		this.showError(i18n(Key.musicPlayerErrorSong));

		if (this.state.playlist.length > 1) {
			setTimeout(() => this.next(true), SKIP_ERROR_DELAY);
		} else if (this.state.playlist.length <= 1) {
			this.showError(i18n(Key.musicPlayerErrorEmpty));
		}
		this.broadcastState();
	}

	private handleAudioLoaded(): void {
		this.state.isLoading = false;
		if (this.audio?.duration && this.audio.duration > 1) {
			this.state.duration = Math.floor(this.audio.duration);
			this.state.currentSong = {
				...this.state.currentSong,
				duration: this.state.duration,
			};
		}

		if (this.state.willAutoPlay || this.state.isPlaying) {
			const playPromise = this.audio?.play();
			if (playPromise !== undefined) {
				playPromise.catch(() => {
					this.state.autoplayFailed = true;
					this.state.isPlaying = false;
				});
			}
		}
		this.broadcastState();
	}

	private loadVolumeFromStorage(): void {
		if (typeof localStorage !== "undefined") {
			const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
			if (savedVolume) {
				const volume = Number.parseFloat(savedVolume);
				if (!Number.isNaN(volume) && volume >= 0 && volume <= 1) {
					this.state.volume = volume;
					this.state.isMuted = volume === 0;
					if (this.audio) {
						this.audio.volume = volume;
						this.audio.muted = this.state.isMuted;
					}
				}
			}
		}
	}

	private registerInteractionHandler(): void {
		const handler = () => {
			if (this.state.autoplayFailed && this.audio) {
				const playPromise = this.audio.play();
				if (playPromise !== undefined) {
					playPromise
						.then(() => {
							this.state.autoplayFailed = false;
						})
						.catch(() => {});
				}
			}
		};
		document.addEventListener("click", handler, { once: true });
		document.addEventListener("keydown", handler, { once: true });
		this.unregisterInteraction = () => {
			document.removeEventListener("click", handler);
			document.removeEventListener("keydown", handler);
		};
	}

	private async loadPlaylist(): Promise<void> {
		if (this.state.mode === "local") {
			this.loadLocalPlaylist();
		} else {
			await this.fetchCloudPlaylist(this.state.cloudPlaylistId);
		}
	}

	private async fetchCloudPlaylist(id: string): Promise<boolean> {
		const api =
			musicPlayerConfig.meting_api ??
			"https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r";
		const server = musicPlayerConfig.server ?? "netease";
		const type = musicPlayerConfig.type ?? "playlist";

		if (!api || !id) {
			return false;
		}

		this.state.isLoading = true;
		this.broadcastState();

		const apis = [api, ...FALLBACK_METING_APIS];
		let list: Record<string, unknown>[] | null = null;

		for (const baseApi of apis) {
			const apiUrl = baseApi
				.replace(":server", server)
				.replace(":type", type)
				.replace(":id", id)
				.replace(":auth", "")
				.replace(":r", Date.now().toString());

			try {
				const res = await fetch(apiUrl);
				if (!res.ok) {
					throw new Error("meting api error");
				}
				const data: Record<string, unknown>[] = await res.json();
				if (Array.isArray(data) && data.length > 0) {
					list = data;
					break;
				}
			} catch (_e) {
				// try next api
			}
		}

		if (list) {
			this.state.playlist = list.map((song) => this.convertMetingSong(song));
			this.state.isLoading = false;

			if (this.state.playlist.length > 0) {
				this.loadSong(this.state.playlist[0], false);
			}
			this.broadcastState();
			return true;
		}
		this.showError(i18n(Key.musicPlayerErrorPlaylist));
		this.state.isLoading = false;
		this.broadcastState();
		return false;
	}

	private convertMetingSong(song: Record<string, unknown>): Song {
		const name = typeof song.name === "string" ? song.name : undefined;
		const songTitle = typeof song.title === "string" ? song.title : undefined;
		const title = name ?? songTitle ?? i18n(Key.unknownSong);
		const artistField =
			typeof song.artist === "string" ? song.artist : undefined;
		const author = typeof song.author === "string" ? song.author : undefined;
		const artist = artistField ?? author ?? i18n(Key.unknownArtist);
		let dur = (song.duration as number | undefined) ?? 0;
		if (typeof dur === "string") {
			dur = Number.parseInt(dur, 10);
		}
		if (dur > 10000) {
			dur = Math.floor(dur / 1000);
		}
		if (!Number.isFinite(dur) || dur <= 0) {
			dur = 0;
		}

		return {
			id:
				typeof song.id === "string"
					? Number.parseInt(song.id, 10)
					: ((song.id as number | undefined) ?? 0),
			title,
			artist,
			cover: (song.pic as string | undefined) ?? "",
			url: (song.url as string | undefined) ?? "",
			duration: dur,
			lrc: (song.lrc as string | undefined) ?? undefined,
		};
	}

	private loadLocalPlaylist(): void {
		this.state.playlist = [...this.state.localPlaylist];
		if (this.state.playlist.length === 0) {
			this.showError("本地播放列表为空");
		} else {
			this.loadSong(this.state.playlist[0], false);
		}
	}

	private loadSong(song: Song, autoPlay = true): void {
		if (!song?.url) {
			return;
		}
		if (song.url !== this.state.currentSong.url) {
			this.state.currentSong = { ...song };
			if (song.url) {
				this.state.isLoading = true;
			} else {
				this.state.isLoading = false;
			}
			this.persistResume();
		}
		this.state.willAutoPlay = autoPlay;
		this.loadLyrics(song);
		if (this.audio) {
			if (this.audio.src && song.url) {
				this.audio.src = "";
			}
			this.audio.src = getAssetPath(song.url);
			this.audio.load();
		}
		this.broadcastState();
	}

	private loadLyrics(song: Song): void {
		this.state.lyrics = [];
		this.state.currentLrcIndex = -1;

		if (!song.lrc) {
			return;
		}

		const isLrcUrl =
			/^(https?:)?\/\//.test(song.lrc) ||
			song.lrc.startsWith("/") ||
			/\.(lrc|txt)(\?|#|$)/i.test(song.lrc);

		if (isLrcUrl) {
			// 确保相对路径 lrc 从站点根目录解析，避免在 /music/
			// 子路径下 fetch 变成 /music/assets/music/lrc/xxx.lrc 导致 404
			const lrcUrl = getAssetPath(song.lrc);
			fetch(lrcUrl)
				.then((r) => r.text())
				.then((text) => {
					this.state.lyrics = parseLRC(text);
					this.broadcastState();
				})
				.catch(() => {
					this.state.lyrics = [];
					this.broadcastState();
				});
		} else {
			this.state.lyrics = parseLRC(song.lrc);
		}
	}

	private updateLyricsIndex(currentTime: number): void {
		if (this.state.lyrics.length === 0) {
			if (this.state.currentLrcIndex !== -1) {
				this.state.currentLrcIndex = -1;
			}
			return;
		}
		let idx = -1;
		for (let i = 0; i < this.state.lyrics.length; i++) {
			if (currentTime >= this.state.lyrics[i].time) idx = i;
			else break;
		}
		this.state.currentLrcIndex = idx;
	}

	private persistResume(): void {
		if (typeof sessionStorage === "undefined") {
			return;
		}
		const song = this.state.currentSong;
		if (!song?.url) {
			return;
		}
		const snapshot: ResumeSnapshot = {
			id: song.id,
			url: song.url,
			title: song.title,
			artist: song.artist,
			cover: song.cover,
			lrc: song.lrc,
			currentTime: this.audio ? this.audio.currentTime : this.state.currentTime,
			isPlaying: this.state.isPlaying,
			mode: this.state.mode,
			cloudPlaylistId: this.state.cloudPlaylistId,
		};
		try {
			sessionStorage.setItem(STORAGE_KEY_RESUME, JSON.stringify(snapshot));
		} catch {
			// ignore quota / serialization errors
		}
	}

	private applyResumeIfAny(rawFromInit?: string | null): void {
		if (typeof sessionStorage === "undefined") {
			return;
		}
		const raw = rawFromInit ?? sessionStorage.getItem(STORAGE_KEY_RESUME);
		if (!raw) {
			return;
		}
		let snap: ResumeSnapshot;
		try {
			snap = JSON.parse(raw) as ResumeSnapshot;
		} catch {
			return;
		}
		if (!snap?.url) {
			return;
		}
		if (this.state.playlist.length === 0) {
			return;
		}
		let idx = this.state.playlist.findIndex(
			(s) =>
				(snap.id !== undefined && s.id === snap.id && s.id !== 0) ||
				(s.url && s.url === snap.url),
		);
		if (idx < 0) {
			// 快照歌曲不在当前歌单（典型场景：播放的是网易云歌单的歌曲，
			// 整页刷新后本地歌单里没有它）。直接用快照恢复同一首歌，
			// 插到歌单首位，不额外请求 Meting API。
			const restored: Song = {
				id: snap.id ?? 0,
				title: snap.title,
				artist: snap.artist,
				cover: snap.cover,
				url: snap.url,
				duration: 0,
				lrc: snap.lrc,
			};
			this.state.playlist.unshift(restored);
			idx = 0;
		}
		this.state.currentIndex = idx;
		// 打开网站不自动播放：恢复上次歌曲与进度，但保持暂停，
		// 等待用户手动点击播放（避免刷新/路由跳转后突然出声）
		const shouldPlay = false;
		this.state.isPlaying = false;
		this.state.currentTime = snap.currentTime || 0;
		if (snap.currentTime && snap.currentTime > 0.5) {
			this.pendingSeekTime = snap.currentTime;
		}
		this.loadSong(this.state.playlist[idx], shouldPlay);
	}

	private showError(message: string): void {
		this.state.errorMessage = message;
		this.state.showError = true;
		setTimeout(() => {
			this.state.showError = false;
			this.broadcastState();
		}, 3000);
		this.broadcastState();
	}

	hideError(): void {
		this.state.showError = false;
		this.broadcastState();
	}

	toggle(): void {
		if (!this.audio || !this.state.currentSong.url) {
			return;
		}
		if (this.state.isPlaying) {
			this.audio.pause();
		} else {
			this.audio.play().catch(() => {});
		}
	}

	play(): void {
		if (!this.audio || !this.state.currentSong.url) {
			return;
		}
		this.audio.play().catch(() => {});
	}

	pause(): void {
		if (!this.audio || !this.state.currentSong.url) {
			return;
		}
		this.audio.pause();
	}

	next(autoPlay = true): void {
		if (this.state.playlist.length <= 1) {
			return;
		}

		let newIndex: number;
		if (this.state.isShuffled) {
			do {
				newIndex = Math.floor(Math.random() * this.state.playlist.length);
			} while (
				newIndex === this.state.currentIndex &&
				this.state.playlist.length > 1
			);
		} else {
			newIndex =
				this.state.currentIndex < this.state.playlist.length - 1
					? this.state.currentIndex + 1
					: 0;
		}

		this.state.currentIndex = newIndex;
		this.loadSong(this.state.playlist[newIndex], autoPlay);
	}

	prev(): void {
		if (this.state.playlist.length <= 1) {
			return;
		}
		const newIndex =
			this.state.currentIndex > 0
				? this.state.currentIndex - 1
				: this.state.playlist.length - 1;
		this.state.currentIndex = newIndex;
		this.loadSong(this.state.playlist[newIndex], true);
	}

	playIndex(index: number): void {
		if (index < 0 || index >= this.state.playlist.length) {
			return;
		}
		this.state.currentIndex = index;
		this.loadSong(this.state.playlist[index], true);
	}

	seek(time: number): void {
		if (!this.audio || !this.state.currentSong.url) {
			return;
		}
		if (time >= 0 && time <= this.state.duration) {
			this.audio.currentTime = time;
			this.state.currentTime = time;
			this.updateLyricsIndex(time);
			this.persistResume();
			this.broadcastState();
		}
	}

	setVolume(volume: number): void {
		const clampedVolume = Math.max(0, Math.min(1, volume));
		this.state.volume = clampedVolume;
		this.state.isMuted = clampedVolume === 0;
		if (this.audio) {
			this.audio.volume = clampedVolume;
			this.audio.muted = this.state.isMuted;
		}
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORAGE_KEY_VOLUME, String(clampedVolume));
		}
		this.broadcastState();
	}

	toggleMute(): void {
		this.state.isMuted = !this.state.isMuted;
		if (this.audio) {
			this.audio.muted = this.state.isMuted;
		}
		this.broadcastState();
	}

	toggleShuffle(): void {
		this.state.isShuffled = !this.state.isShuffled;
		if (this.state.isShuffled) {
			this.state.isRepeating = 0;
		}
		this.broadcastState();
	}

	toggleRepeat(): void {
		this.state.isRepeating = ((this.state.isRepeating + 1) % 3) as RepeatMode;
		if (this.state.isRepeating !== 0) {
			this.state.isShuffled = false;
		}
		this.broadcastState();
	}

	toggleMode(): void {
		if (this.state.isShuffled) {
			this.toggleShuffle();
			return;
		}
		if (this.state.isRepeating === 2) {
			this.toggleRepeat();
			this.toggleShuffle();
			return;
		}
		this.toggleRepeat();
	}

	async setMode(mode: PlayerMode): Promise<void> {
		if (this.state.mode === mode) {
			return;
		}
		const prevMode = this.state.mode;
		this.state.mode = mode;
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORAGE_KEY_MODE, mode);
		}

		if (mode === "local") {
			this.loadLocalPlaylist();
		} else {
			const targetId = this.state.cloudPlaylistId || musicPlayerConfig.id || "";
			const ok = await this.fetchCloudPlaylist(targetId);
			// 切回在线但网易云接口拉取失败时，回滚到原模式并恢复原歌单，
			// 避免“在线模式却仍是本地歌单”的割裂状态（即看起来“切不回去”）
			if (!ok) {
				this.state.mode = prevMode;
				if (typeof localStorage !== "undefined") {
					localStorage.setItem(STORAGE_KEY_MODE, prevMode);
				}
				this.showError("无法加载网易云歌单，已保持当前模式");
				if (prevMode === "local") {
					this.loadLocalPlaylist();
				}
			}
		}
		this.persistResume();
	}

	async switchCloudPlaylist(id: string): Promise<void> {
		if (!id) {
			return;
		}
		this.state.cloudPlaylistId = id;
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORAGE_KEY_CLOUD_PLAYLIST_ID, id);
		}
		// 输入歌单 ID 即代表使用网易云在线模式：直接切到 online 并拉取，
		// 这样在本地模式下也能通过输入 ID 切换到在线歌单
		this.state.mode = "online";
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORAGE_KEY_MODE, "online");
		}
		await this.fetchCloudPlaylist(id);
		this.persistResume();
	}

	async resetCloudPlaylist(): Promise<void> {
		const defaultId = musicPlayerConfig.id ?? "";
		if (typeof localStorage !== "undefined") {
			localStorage.removeItem(STORAGE_KEY_CLOUD_PLAYLIST_ID);
		}
		this.state.cloudPlaylistId = defaultId;
		this.state.mode = "online";
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORAGE_KEY_MODE, "online");
		}
		await this.fetchCloudPlaylist(defaultId);
		this.persistResume();
	}

	togglePlaylist(): void {
		this.state.showPlaylist = !this.state.showPlaylist;
		this.broadcastState();
	}

	toggleExpanded(): void {
		this.state.isExpanded = !this.state.isExpanded;
		// 保持与原先 usePlayerState.toggleExpandedUI 一致的联动行为：
		// 展开时强制取消隐藏，并关闭播放列表，避免状态组合异常
		if (this.state.isExpanded) {
			this.state.showPlaylist = false;
			this.state.isHidden = false;
		}
		this.broadcastState();
	}

	toggleHidden(): void {
		this.state.isHidden = !this.state.isHidden;
		// 保持与原先 usePlayerState.toggleHiddenUI 一致的联动行为：
		// 隐藏时收起播放器并关闭播放列表，防止展开 UI 悬挂在小球旁边
		if (this.state.isHidden) {
			this.state.isExpanded = false;
			this.state.showPlaylist = false;
		}
		this.broadcastState();
	}

	canSkip(): boolean {
		return this.state.playlist.length > 1;
	}

	setProgress(percent: number): void {
		if (!this.audio || !this.state.currentSong.url) {
			return;
		}
		const newTime = percent * this.state.duration;
		this.audio.currentTime = newTime;
		this.state.currentTime = newTime;
		this.updateLyricsIndex(newTime);
		this.persistResume();
		this.broadcastState();
	}

	private broadcastState(): void {
		const snapshot = this.createSnapshot();

		for (const listener of this.listeners) {
			listener(snapshot);
		}

		if (typeof window === "undefined") {
			return;
		}
		window.dispatchEvent(
			new CustomEvent("music-sidebar:state", {
				detail: snapshot,
			}),
		);
	}

	destroy(): void {
		if (this.unregisterInteraction) {
			this.unregisterInteraction();
		}
		if (typeof window !== "undefined") {
			window.removeEventListener("beforeunload", this.persistOnUnload);
		}
		if (this.audio) {
			this.audio.pause();
			this.audio.src = "";
			this.audio = null;
		}
		this.isInitialized = false;
	}
}

export const musicPlayerStore = new MusicPlayerStore();
