import type { SpotifyTrack } from '../spotify/types'

export class AudioPlayer {
  private audio: HTMLAudioElement
  private onTimeUpdate?: (currentTime: number, duration: number) => void
  private onEnded?: () => void

  constructor() {
    this.audio = new Audio()
    this.audio.crossOrigin = 'anonymous'
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.audio.addEventListener('timeupdate', () => {
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.audio.currentTime, this.audio.duration)
      }
    })

    this.audio.addEventListener('ended', () => {
      if (this.onEnded) {
        this.onEnded()
      }
    })

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e)
    })
  }

  loadTrack(track: SpotifyTrack): boolean {
    if (!track.preview_url) {
      console.warn('No preview URL available for track:', track.name)
      return false
    }

    this.audio.src = track.preview_url
    this.audio.load()
    return true
  }

  play(): Promise<void> {
    return this.audio.play()
  }

  pause(): void {
    this.audio.pause()
  }

  stop(): void {
    this.audio.pause()
    this.audio.currentTime = 0
  }

  setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume))
  }

  get isPlaying(): boolean {
    return !this.audio.paused
  }

  get currentTime(): number {
    return this.audio.currentTime
  }

  get duration(): number {
    return this.audio.duration || 0
  }

  onTimeUpdateCallback(callback: (currentTime: number, duration: number) => void): void {
    this.onTimeUpdate = callback
  }

  onEndedCallback(callback: () => void): void {
    this.onEnded = callback
  }
}