/**
 * AudioEngine — handles mic input, file playback, and demo mode.
 * Provides frequency and time-domain data for visualizers.
 */

export type AudioSource = 'mic' | 'file' | 'demo';

export interface AudioData {
  frequency: Uint8Array;
  timeDomain: Uint8Array;
  bass: number;      // 0-1 average energy 20-250Hz
  mid: number;       // 0-1 average energy 250-2kHz
  treble: number;    // 0-1 average energy 2k-20kHz
  energy: number;    // 0-1 overall energy
  peak: number;      // 0-1 current peak
}

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

  get isActive(): boolean { return this._isActive; }
  get sourceType(): AudioSource { return this.currentSource; }
  get fftSize(): number { return this._fftSize; }

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
    return analyser;
  }

  async startMic(): Promise<void> {
    this.stop();
    const ctx = await this.ensureContext();
    const analyser = this.setupAnalyser(ctx);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaStream = stream;
    this.source = ctx.createMediaStreamSource(stream);
    this.source.connect(analyser);
    this.currentSource = 'mic';
    this._isActive = true;
  }

  async startFile(file: File): Promise<HTMLAudioElement> {
    this.stop();
    const ctx = await this.ensureContext();
    const analyser = this.setupAnalyser(ctx);

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

    await audio.play();
    return audio;
  }

  async startDemo(): Promise<void> {
    this.stop();
    const ctx = await this.ensureContext();
    const analyser = this.setupAnalyser(ctx);

    // Create a rich demo sound with multiple oscillators
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
    this.gainNode = masterGain;

    const freqs = [110, 220, 330, 440, 550, 880];
    const types: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'sine', 'sine', 'sine'];

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
  }

  getData(): AudioData {
    if (!this.analyser) {
      const empty = new Uint8Array(this._fftSize / 2);
      return { frequency: empty, timeDomain: empty, bass: 0, mid: 0, treble: 0, energy: 0, peak: 0 };
    }

    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeDomainData);

    const binCount = this.analyser.frequencyBinCount;
    const sampleRate = this.ctx!.sampleRate;
    const binWidth = sampleRate / this._fftSize;

    // Bass: 20-250Hz
    const bassEnd = Math.min(Math.floor(250 / binWidth), binCount);
    const bassStart = Math.max(Math.floor(20 / binWidth), 0);
    // Mid: 250-2000Hz
    const midEnd = Math.min(Math.floor(2000 / binWidth), binCount);
    // Treble: 2000-20000Hz
    const trebleEnd = Math.min(Math.floor(20000 / binWidth), binCount);

    let bassSum = 0, midSum = 0, trebleSum = 0, totalSum = 0, peak = 0;
    let bassCount = 0, midCount = 0, trebleCount = 0;

    for (let i = 0; i < binCount; i++) {
      const v = this.frequencyData[i];
      totalSum += v;
      if (v > peak) peak = v;
      if (i >= bassStart && i < bassEnd) { bassSum += v; bassCount++; }
      else if (i >= bassEnd && i < midEnd) { midSum += v; midCount++; }
      else if (i >= midEnd && i < trebleEnd) { trebleSum += v; trebleCount++; }
    }

    return {
      frequency: this.frequencyData,
      timeDomain: this.timeDomainData,
      bass: bassCount ? (bassSum / bassCount) / 255 : 0,
      mid: midCount ? (midSum / midCount) / 255 : 0,
      treble: trebleCount ? (trebleSum / trebleCount) / 255 : 0,
      energy: binCount ? (totalSum / binCount) / 255 : 0,
      peak: peak / 255,
    };
  }

  setGain(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }

  stop(): void {
    this._isActive = false;

    if (this.demoInterval !== null) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.demoOscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
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
      try { this.source.disconnect(); } catch {}
      this.source = null;
    }
    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch {}
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
