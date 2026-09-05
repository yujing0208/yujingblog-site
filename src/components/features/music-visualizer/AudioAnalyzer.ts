import * as THREE from "three";

export interface AudioData {
	bass: number;
	mid: number;
	treble: number;
	energy: number;
	subBass: number;
	lowMid: number;
	highMid: number;
	presence: number;
	brilliance: number;
	air: number;
	warmth: number;
	brightness: number;
	sharpness: number;
	smoothness: number;
	density: number;
	spectralCentroid: number;
}

interface Ripple {
	pos: THREE.Vector2;
	time: number;
	strength: number;
	isActive: number;
	rippleType: number;
}

export interface AudioAnalyzerEvents {
	onRipple?: (x: number, z: number, strength: number, isWhite: boolean) => void;
	onMeteor?: (strength: number) => void;
	onBeat?: (strength: number) => void;
}

export class AudioAnalyzer {
	public audioCtx: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private source: MediaElementAudioSourceNode | null = null;
	private gainNode: GainNode | null = null;
	private audioElement: HTMLAudioElement | null = null;
	private dataArray = new Uint8Array(512);
	private prevData: number[] = new Array(512).fill(0);
	private prevBrightness = 0;
	private connected = false;
	private events: AudioAnalyzerEvents = {};

	private smoothedData: AudioData = {
		bass: 0,
		mid: 0,
		treble: 0,
		energy: 0,
		subBass: 0,
		lowMid: 0,
		highMid: 0,
		presence: 0,
		brilliance: 0,
		air: 0,
		warmth: 0,
		brightness: 0,
		sharpness: 0,
		smoothness: 0,
		density: 0,
		spectralCentroid: 0,
	};

	private beatCooldown = 0;
	private beatHistory: number[] = new Array(40).fill(0);
	private beatHistoryIndex = 0;
	private meteorCooldown = 0;

	setEvents(events: AudioAnalyzerEvents) {
		this.events = events;
	}

	connect(audioEl: HTMLAudioElement) {
		// 全局音频元素唯一：若换成别的 <audio>（理论上不会发生），先彻底拆除旧图再重建。
		if (this.audioElement && this.audioElement !== audioEl) {
			this.teardownGraph();
		}
		this.audioElement = audioEl;

		// Web Audio 硬性约束：createMediaElementSource 对同一 <audio> 元素只能调用一次，
		// 且调用后该元素的输出即被永久接入 Web Audio 图。因此音频图（source->gain->destination）
		// 需常驻，绝不能每次进入 3D 页面都重建、也不能离开时关闭 AudioContext，
		// 否则第二次进入会因 InvalidStateError 失败、且底层音乐会被静音/打断。
		if (!this.audioCtx) {
			const AC: typeof AudioContext =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			if (!AC) return;
			this.audioCtx = new AC();
			this.analyser = this.audioCtx.createAnalyser();
			this.analyser.fftSize = 1024;
			this.analyser.smoothingTimeConstant = 0.8;

			this.gainNode = this.audioCtx.createGain();
			this.gainNode.gain.value = 1;

			try {
				// 仅此一次：把全局 <audio> 接入 Web Audio 图。
				// source -> gain -> destination（扬声器，常驻）；gain -> analyser（分析抽头）。
				this.source = this.audioCtx.createMediaElementSource(audioEl);
				this.source.connect(this.gainNode);
				this.gainNode.connect(this.audioCtx.destination);
				this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
			} catch (e) {
				console.warn(
					"AudioAnalyzer: 无法为该音频元素创建 MediaElementSource（同一元素只能创建一次）",
					e,
				);
			}
		}

		// （重新）连接分析器抽头；同目标重复 connect 会被浏览器合并，安全幂等。
		if (this.gainNode && this.analyser) {
			try {
				this.gainNode.connect(this.analyser);
			} catch {
				// 已连接则忽略
			}
		}

		this.connected = true;
		if (this.audioCtx.state === "suspended") {
			this.audioCtx.resume();
		}
	}

	disconnect() {
		// 离开 3D 页面：只摘掉分析器抽头，保留 source->gain->destination 与 AudioContext，
		// 这样底层音乐（同一首歌）继续通过扬声器播放，不会因断开扬声器或关闭上下文而静音/重载。
		if (this.gainNode && this.analyser) {
			try {
				this.gainNode.disconnect(this.analyser);
			} catch {
				// 抽头本就不存在则忽略
			}
		}
		this.connected = false;
	}

	private teardownGraph(): void {
		try {
			this.source?.disconnect();
		} catch {
			/* ignore */
		}
		try {
			this.gainNode?.disconnect();
		} catch {
			/* ignore */
		}
		try {
			this.analyser?.disconnect();
		} catch {
			/* ignore */
		}
		this.source = null;
		this.gainNode = null;
		this.analyser = null;
		if (this.audioCtx) {
			try {
				this.audioCtx.close();
			} catch {
				/* ignore */
			}
			this.audioCtx = null;
		}
		this.connected = false;
	}

	isConnected() {
		return this.connected;
	}

	resume() {
		if (this.audioCtx?.state === "suspended") {
			this.audioCtx.resume();
		}
	}

	update(_delta: number): AudioData {
		if (!this.analyser) {
			return { ...this.smoothedData };
		}

		const isPlaying = this.audioElement
			? !this.audioElement.paused && !this.audioElement.ended
			: false;

		let energySum = 0;
		let centroidNum = 0;
		let centroidDen = 0;
		let subBassSum = 0;
		let bassSum = 0;
		let lowMidSum = 0;
		let midSum = 0;
		let highMidSum = 0;
		let presenceSum = 0;
		let brillianceSum = 0;
		let airSum = 0;
		let jumpVolatilitySum = 0;
		let fluxPulse = 0;
		let fluxMeteor = 0;

		const binCount = this.dataArray.length;

		if (isPlaying) {
			this.analyser.getByteFrequencyData(this.dataArray);

			for (let i = 0; i < binCount; i++) {
				const val = this.dataArray[i] / 255;
				energySum += val;
				centroidNum += i * val;
				centroidDen += val;

				const prevVal = this.prevData[i] || 0;
				jumpVolatilitySum += Math.abs(val - prevVal);

				if (i >= 0 && i <= 16) {
					const diff = val - prevVal;
					if (diff > 0) fluxPulse += diff;
				}

				if (i >= 159 && i <= 174) {
					const diff = val - prevVal;
					if (diff > 0) fluxMeteor += diff;
				}

				this.prevData[i] = val;

				if (i <= 1) subBassSum += val;
				else if (i <= 3) bassSum += val;
				else if (i <= 7) lowMidSum += val;
				else if (i <= 18) midSum += val;
				else if (i <= 46) highMidSum += val;
				else if (i <= 93) presenceSum += val;
				else if (i <= 186) brillianceSum += val;
				else if (i <= 372) airSum += val;
			}

			this.detectBeats(fluxPulse, fluxMeteor);
		} else {
			for (let i = 0; i < binCount; i++) {
				this.dataArray[i] = Math.floor(this.dataArray[i] * 0.94);
				this.prevData[i] = 0;
			}
		}

		if (this.beatCooldown > 0) this.beatCooldown--;
		if (this.meteorCooldown > 0) this.meteorCooldown--;

		const energy = energySum / binCount;
		const subBass = subBassSum / 2;
		const bass = bassSum / 2;
		const lowMid = lowMidSum / 4;
		const mid = midSum / 11;
		const highMid = highMidSum / 28;
		const presence = presenceSum / 47;
		const brilliance = brillianceSum / 93;
		const air = airSum / 186;

		const oldBass = (subBassSum + bassSum + lowMidSum) / 8;
		const oldMid = (midSum + highMidSum) / 39;
		const oldTreble = (presenceSum + brillianceSum + airSum) / 326;

		const warmth =
			energySum > 0
				? (subBassSum + bassSum + lowMidSum + midSum) / energySum
				: 0;
		const brightness =
			energySum > 0 ? (presenceSum + brillianceSum + airSum) / energySum : 0;
		const sharpness = Math.max(0, brightness - this.prevBrightness) * 10;
		this.prevBrightness = brightness;

		const smoothnessVal = Math.max(0, 1 - (jumpVolatilitySum / binCount) * 2);

		const activeThreshold = energy * 1.5;
		let activeBands = 0;
		if (subBass > activeThreshold) activeBands++;
		if (bass > activeThreshold) activeBands++;
		if (lowMid > activeThreshold) activeBands++;
		if (mid > activeThreshold) activeBands++;
		if (highMid > activeThreshold) activeBands++;
		if (presence > activeThreshold) activeBands++;
		if (brilliance > activeThreshold) activeBands++;
		if (air > activeThreshold) activeBands++;
		const density = activeBands / 8;

		const spectralCentroid = centroidDen > 0 ? centroidNum / centroidDen : 0;

		const dt = isPlaying ? 0.15 : 0.05;

		this.smoothedData.bass += (oldBass - this.smoothedData.bass) * dt;
		this.smoothedData.mid += (oldMid - this.smoothedData.mid) * dt;
		this.smoothedData.treble += (oldTreble - this.smoothedData.treble) * dt;
		this.smoothedData.energy += (energy - this.smoothedData.energy) * dt;
		this.smoothedData.subBass += (subBass - this.smoothedData.subBass) * dt;
		this.smoothedData.lowMid += (lowMid - this.smoothedData.lowMid) * dt;
		this.smoothedData.highMid += (highMid - this.smoothedData.highMid) * dt;
		this.smoothedData.presence += (presence - this.smoothedData.presence) * dt;
		this.smoothedData.brilliance +=
			(brilliance - this.smoothedData.brilliance) * dt;
		this.smoothedData.air += (air - this.smoothedData.air) * dt;
		this.smoothedData.warmth += (warmth - this.smoothedData.warmth) * dt;
		this.smoothedData.brightness +=
			(brightness - this.smoothedData.brightness) * dt;
		this.smoothedData.sharpness +=
			(sharpness - this.smoothedData.sharpness) * dt;
		this.smoothedData.smoothness +=
			(smoothnessVal - this.smoothedData.smoothness) * dt;
		this.smoothedData.density += (density - this.smoothedData.density) * dt;
		this.smoothedData.spectralCentroid +=
			(spectralCentroid - this.smoothedData.spectralCentroid) * dt;

		return { ...this.smoothedData };
	}

	private detectBeats(fluxPulse: number, fluxMeteor: number) {
		const smoothedFlux = fluxPulse;
		this.beatHistory[this.beatHistoryIndex] = smoothedFlux;
		this.beatHistoryIndex =
			(this.beatHistoryIndex + 1) % this.beatHistory.length;

		let avgFlux = 0;
		for (let i = 0; i < this.beatHistory.length; i++)
			avgFlux += this.beatHistory[i];
		avgFlux /= this.beatHistory.length;

		let fluxVariance = 0;
		for (let i = 0; i < this.beatHistory.length; i++) {
			fluxVariance += (this.beatHistory[i] - avgFlux) ** 2;
		}
		fluxVariance /= this.beatHistory.length;
		const fluxStdDev = Math.sqrt(fluxVariance);

		const threshold = Math.max(0.05, avgFlux + fluxStdDev * 1.5);

		if (
			this.beatCooldown <= 0 &&
			smoothedFlux > threshold &&
			smoothedFlux > 0.02
		) {
			const strength = Math.min(smoothedFlux * 3, 4);
			const angle = Math.random() * Math.PI * 2;
			const dist = Math.random() * 20;
			const rx = Math.cos(angle) * dist;
			const rz = Math.sin(angle) * dist;
			this.events.onRipple?.(rx, rz, strength, false);
			this.events.onBeat?.(strength);
			this.beatCooldown = 20;
		}

		if (this.meteorCooldown <= 0 && fluxMeteor > 0.08) {
			const strength = Math.min(fluxMeteor * 2, 1);
			this.events.onMeteor?.(strength);
			this.meteorCooldown = 40 + Math.random() * 60;
		}
	}

	static getRipplesArray(): Ripple[] {
		return new Array(10).fill(null).map(() => ({
			pos: new THREE.Vector2(),
			time: -100,
			strength: 0,
			isActive: 0,
			rippleType: 0,
		}));
	}

	addClickRipple(x: number, z: number) {
		this.events.onRipple?.(x, z, 1.5, false);
	}
}

// 单例：与全局 musicPlayerStore 同理，音频分析器需跨 3D 页面多次进入/离开而常驻，
// 以保证全局 <audio> 只被接入 Web Audio 图一次，且扬声器通路不被拆除。
export const audioAnalyzer = new AudioAnalyzer();
