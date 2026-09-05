export interface Song {
	id: number;
	title: string;
	artist: string;
	cover: string;
	url: string;
	duration: number;
	lrc?: string;
}

export type RepeatMode = 0 | 1 | 2;

export interface PlayerState {
	isPlaying: boolean;
	isExpanded: boolean;
	isHidden: boolean;
	showPlaylist: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	isMuted: boolean;
	isLoading: boolean;
	isShuffled: boolean;
	isRepeating: RepeatMode;
	errorMessage: string;
	showError: boolean;
	currentSong: Song;
	playlist: Song[];
	currentIndex: number;
	autoplayFailed: boolean;
	willAutoPlay: boolean;
	cloudPlaylistId: string;
	lyrics: { time: number; text: string }[];
	currentLrcIndex: number;
}
