/**
 * AudioEngine — handles mic input, file playback, demo mode, and Audius streaming.
 * Provides frequency, time-domain, beat detection, BPM, and spectral analysis data.
 */

import type { AudiusTrack } from './AudiusClient';

export type AudioSource = 'mic' | 'file' | 'demo' | 'audius';

export interface TrackInfo {
  title: string;
  artist: string;
  artworkUrl?: string;
  duration?: number;
  source: AudioSource;
}

export interface AudioData {
  frequency: Uint8Array;
  timeDomain: Uint8Array;
  bass: number;          // 0-1 average energy 20-250Hz
  mid: number;           // 0-1 average energy 250-2kHz
  treble: number;        // 0-1 average energy 2k-20kHz
  energy: number;        // 0-1 overall energy
  peak: number;          // 0-1 current peak
  isBeat: boolean;       // true when a beat is detected this frame
  beatIntensity: number; // 0-1 strength of the beat
  bpm: number;           // estimated BPM (0 when unknown)
  spectralFlux: number;  // rate of spectral change (0-1)
  subBass: number;       // 20-60Hz band (0-1)
  upperMid: number;      // 2000-6000Hz band (0-1)
  presence: number;      // 6000-20000Hz band (0-1)
}

const ENERGY_HISTORY_SIZE = 43; // ~1 second at 43fps
const BEAT_THRESHOLD = 1.3;     // current energy must exceed 1.3x rolling average
const BPM_WINDOW_MS = 5000;     // track beats over 5 seconds for BPM

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: AudioNode | null = null;
  private gainNode: GainNode | null = null;
  private frequencyData: Uint8Array = new Uint8Array(0);
  private timeDomainData: Uint8Array = new Uint8Array(0);
  private currentSource: AudioSource = 'demo';
  private audioElement: HTMLAudioElement | null = null;
  private mediaStream: MediaStream | null = null;
  private demoOscillators: OscillatorNode[] = [];
  private demoGains: GainNode[] = [];
  private demoInterval: number | null = null;
  private _fftSize = 2048;
  private _isActive = false;

  // Beat detection state
  private energyHistory: number[] = [];
  private beatTimestamps: number[] = [];
  private prevFrequencyData: Uint8Array = new Uint8Array(0);
  private lastBeatTime = 0;
  private readonly minBeatInterval = 150; // ms — ignore beats closer than this (max ~400 BPM)

  // Track info
  private _currentTrack: TrackInfo | null = null;

  get isActive(): boolean { return this._isActive; }
  get sourceType(): AudioSource { return this.currentSource; }
  get fftSize(): number { return this._fftSize; }
  get currentTrack(): TrackInfo | null { return this._currentTrack; }

  getTrackInfo(): TrackInfo | null {
    return this._currentTrack;
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  private setupAnalyser(ctx: AudioContext): AnalyserNode {
    if (this.analyser) {
      this.analyser.disconnect();
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = this._fftSize;
    analyser.smoothingTimeConstant = 0.8;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    this.analyser = analyser;
    this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(analyser.frequencyBinCount);
    this.prevFrequencyData = new Uint8Array(analyser.frequencyBinCount);
    return analyser;
  }

  private resetAnalysisState(): void {
    this.energyHistory = [];
    this.beatTimestamps = [];
    this.lastBeatTime = 0;
    this.prevFrequencyData = new Uint8Array(this._fftSize / 2);
  }

  async startMic(): Promise<void> {
    this.stop();
    const ctx = await this.ensureContext();
    const analyser = this.setupAnalyser(ctx);
    this.resetAnalysisState();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaStream = stream;
    this.source = ctx.createMediaStreamSource(stream);
    this.source.connect(analyser);
    this.currentSource = 'mic';
    this._isActive = true;
    this._currentTrack = { title: 'Microphone Input', artist: 'Live', source: 'mic' };
  }

  async startFile(file: File): Promise<HTMLAudioElement> {
    this.stop();
    const ctx = await this.ensureContext();
    const analyser = this.setupAnalyser(ctx);
    this.resetAnalysisState();

    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.crossOrigin = 'anonymous';
    this.audioElement = audio;

    const source = ctx.createMediaElementSource(audio);
    this.gainNode = ctx.createGain();
    source.connect(this.gainNode);
    this.gainNode.connect(analyser);
    analyser.connect(ctx.destination);
    this.source = source;
    this.currentSource = 'file';
    this._isActive = true;

    // Extract track name from filename (strip extension)
    const name = file.name.replace(/\.[^.]+$/, '');
    this._currentTrack = { title: name, artist: 'Unknown', source: 'file' };

    await audio.play();
    return audio;
  }

  async startAudius(track: AudiusTrack): Promise<HTMLAudioElement> {
    this.stop();
    const ctx = await this.ensureContext();
    const analyser = this.setupAnalyser(ctx);
    this.resetAnalysisState();

    const audio = new Audio();
    audio.src = track.streamUrl;
    audio.crossOrigin = 'anonymous';
    this.audioElement = audio;

    const source = ctx.createMediaElementSource(audio);
    this.gainNode = ctx.createGain();
    source.connect(this.gainNode);
    this.gainNode.connect(analyser);
    analyser.connect(ctx.destination);
    this.source = source;
    this.currentSource = 'audius';
    this._isActive = true;

    this._currentTrack = {
      title: track.title,
      artist: track.artist,
      artworkUrl: track.artworkUrl,
      duration: track.duration,
      source: 'audius',
    };

    await audio.play();
    return audio;
  }

  async startDemo(): Promise<void> {
    this.stop();
    const ctx = await this.ensureContext();
    const analyser = this.setupAnalyser(ctx);
    this.resetAnalysisState();

    // Create a rich demo sound with multiple oscillators
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
    this.gainNode = masterGain;

    const freqs = [110, 220, 330, 440, 550, 880];
    const types: globalThis.OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'sine', 'sine', 'sine'];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = types[i];
      osc.frequency.value = freq;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      this.demoOscillators.push(osc);
      this.demoGains.push(gain);
    });

    // Animate demo oscillators
    let phase = 0;
    this.demoInterval = window.setInterval(() => {
      phase += 0.05;
      this.demoGains.forEach((g, i) => {
        const t = phase + i * 1.2;
        g.gain.value = Math.max(0, Math.sin(t) * 0.5 + Math.sin(t * 0.3) * 0.3 + Math.sin(t * 2.7) * 0.2);
      });
      // Slowly modulate frequencies for interest
      this.demoOscillators.forEach((osc, i) => {
        const base = freqs[i];
        osc.frequency.value = base + Math.sin(phase * 0.2 + i) * base * 0.1;
      });
    }, 50);

    this.currentSource = 'demo';
    this._isActive = true;
    this._currentTrack = { title: 'Demo Mode', artist: 'Synestify', source: 'demo' };
  }

  getData(): AudioData {
    const emptyResult: AudioData = {
      frequency: new Uint8Array(this._fftSize / 2),
      timeDomain: new Uint8Array(this._fftSize / 2),
      bass: 0, mid: 0, treble: 0, energy: 0, peak: 0,
      isBeat: false, beatIntensity: 0, bpm: 0, spectralFlux: 0,
      subBass: 0, upperMid: 0, presence: 0,
    };

    if (!this.analyser) return emptyResult;

    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeDomainData);

    const binCount = this.analyser.frequencyBinCount;
    const sampleRate = this.ctx!.sampleRate;
    const binWidth = sampleRate / this._fftSize;

    // Frequency band boundaries
    const bassStart = Math.max(Math.floor(20 / binWidth), 0);
    const bassEnd = Math.min(Math.floor(250 / binWidth), binCount);
    const midEnd = Math.min(Math.floor(2000 / binWidth), binCount);
    const trebleEnd = Math.min(Math.floor(20000 / binWidth), binCount);

    // Extended bands
    const subBassEnd = Math.min(Math.floor(60 / binWidth), binCount);
    const upperMidStart = Math.min(Math.floor(2000 / binWidth), binCount);
    const upperMidEnd = Math.min(Math.floor(6000 / binWidth), binCount);
    const presenceStart = Math.min(Math.floor(6000 / binWidth), binCount);
    const presenceEnd = trebleEnd;

    let bassSum = 0, midSum = 0, trebleSum = 0, totalSum = 0, peak = 0;
    let bassCount = 0, midCount = 0, trebleCount = 0;
    let subBassSum = 0, subBassCount = 0;
    let upperMidSum = 0, upperMidCount = 0;
    let presenceSum = 0, presenceCount = 0;

    for (let i = 0; i < binCount; i++) {
      const v = this.frequencyData[i];
      totalSum += v;
      if (v > peak) peak = v;

      if (i >= bassStart && i < bassEnd) { bassSum += v; bassCount++; }
      else if (i >= bassEnd && i < midEnd) { midSum += v; midCount++; }
      else if (i >= midEnd && i < trebleEnd) { trebleSum += v; trebleCount++; }

      // Extended bands (overlapping with main bands intentionally)
      if (i >= bassStart && i < subBassEnd) { subBassSum += v; subBassCount++; }
      if (i >= upperMidStart && i < upperMidEnd) { upperMidSum += v; upperMidCount++; }
      if (i >= presenceStart && i < presenceEnd) { presenceSum += v; presenceCount++; }
    }

    const energy = binCount ? (totalSum / binCount) / 255 : 0;

    // --- Spectral Flux ---
    let fluxSum = 0;
    for (let i = 0; i < binCount; i++) {
      const diff = this.frequencyData[i] - this.prevFrequencyData[i];
      // Only count positive changes (onset detection — we care about energy increases)
      if (diff > 0) fluxSum += diff;
    }
    // Normalize: max possible flux is 255 * binCount
    const spectralFlux = binCount ? Math.min(1, fluxSum / (binCount * 40)) : 0;

    // Save current frame for next spectral flux calculation
    this.prevFrequencyData.set(this.frequencyData);

    // --- Beat Detection ---
    this.energyHistory.push(energy);
    if (this.energyHistory.length > ENERGY_HISTORY_SIZE) {
      this.energyHistory.shift();
    }

    const avgEnergy = this.energyHistory.length > 0
      ? this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
      : 0;

    const now = performance.now();
    const threshold = avgEnergy * BEAT_THRESHOLD;
    let isBeat = false;
    let beatIntensity = 0;

    if (energy > threshold && avgEnergy > 0.01 && (now - this.lastBeatTime) > this.minBeatInterval) {
      isBeat = true;
      beatIntensity = Math.min(1, (energy - threshold) / Math.max(avgEnergy, 0.01));
      this.lastBeatTime = now;
      this.beatTimestamps.push(now);
    }

    // --- BPM Estimation ---
    // Keep only beats in the last BPM_WINDOW_MS
    const cutoff = now - BPM_WINDOW_MS;
    while (this.beatTimestamps.length > 0 && this.beatTimestamps[0] < cutoff) {
      this.beatTimestamps.shift();
    }

    let bpm = 0;
    if (this.beatTimestamps.length >= 3) {
      const intervals: number[] = [];
      for (let i = 1; i < this.beatTimestamps.length; i++) {
        intervals.push(this.beatTimestamps[i] - this.beatTimestamps[i - 1]);
      }
      intervals.sort((a, b) => a - b);
      const medianInterval = intervals[Math.floor(intervals.length / 2)];
      if (medianInterval > 0) {
        bpm = Math.round(60000 / medianInterval);
        // Clamp to reasonable BPM range
        if (bpm < 40 || bpm > 220) bpm = 0;
      }
    }

    return {
      frequency: this.frequencyData,
      timeDomain: this.timeDomainData,
      bass: bassCount ? (bassSum / bassCount) / 255 : 0,
      mid: midCount ? (midSum / midCount) / 255 : 0,
      treble: trebleCount ? (trebleSum / trebleCount) / 255 : 0,
      energy,
      peak: peak / 255,
      isBeat,
      beatIntensity,
      bpm,
      spectralFlux,
      subBass: subBassCount ? (subBassSum / subBassCount) / 255 : 0,
      upperMid: upperMidCount ? (upperMidSum / upperMidCount) / 255 : 0,
      presence: presenceCount ? (presenceSum / presenceCount) / 255 : 0,
    };
  }

  setGain(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }

  stop(): void {
    this._isActive = false;
    this._currentTrack = null;

    if (this.demoInterval !== null) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.demoOscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch { /* cleanup */ } });
    this.demoOscillators = [];
    this.demoGains.forEach(g => g.disconnect());
    this.demoGains = [];

    if (this.audioElement) {
      this.audioElement.pause();
      if (this.audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.audioElement.src);
      }
      this.audioElement = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    if (this.source) {
      try { this.source.disconnect(); } catch { /* cleanup */ }
      this.source = null;
    }
    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch { /* cleanup */ }
      this.gainNode = null;
    }
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }

  dispose(): void {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
