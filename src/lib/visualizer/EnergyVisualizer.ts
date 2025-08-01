export interface AudioFeatures {
  acousticness: number
  danceability: number
  energy: number
  instrumentalness: number
  liveness: number
  loudness: number
  speechiness: number
  valence: number
  tempo: number
  key: number
  mode: number
  time_signature: number
}

export class EnergyVisualizer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private animationId: number | null = null
  private lastFeatures: AudioFeatures | null = null
  private pulseTime = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.setupCanvas()
  }

  private setupCanvas(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    
    this.ctx.scale(dpr, dpr)
    
    this.canvas.style.width = rect.width + 'px'
    this.canvas.style.height = rect.height + 'px'
  }

  render(features: AudioFeatures): void {
    this.lastFeatures = features
    if (!this.animationId) {
      this.startAnimation()
    }
  }

  private startAnimation(): void {
    const animate = () => {
      if (this.lastFeatures) {
        this.draw(this.lastFeatures)
        this.pulseTime += 0.02
      }
      this.animationId = requestAnimationFrame(animate)
    }
    animate()
  }

  private draw(features: AudioFeatures): void {
    // Validate and sanitize input features
    const energy = this.clamp(features.energy || 0, 0, 1)
    const valence = this.clamp(features.valence || 0, 0, 1)
    const tempo = this.clamp(features.tempo || 120, 60, 200)
    const danceability = this.clamp(features.danceability || 0, 0, 1)
    const acousticness = this.clamp(features.acousticness || 0, 0, 1)
    
    const rect = this.canvas.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    // Validate canvas dimensions
    if (!rect.width || !rect.height || !isFinite(centerX) || !isFinite(centerY)) {
      return
    }
    
    this.ctx.clearRect(0, 0, rect.width, rect.height)
    
    const baseRadius = Math.min(rect.width, rect.height) * 0.15
    const energyRadius = baseRadius + (energy * baseRadius * 1.5)
    
    const pulseFactor = 1 + Math.sin(this.pulseTime * (tempo / 120) * 4) * 0.1
    const radius = Math.max(1, energyRadius * pulseFactor) // Ensure radius is always positive
    
    const hue = valence * 120
    const saturation = 70 + (danceability * 30)
    const lightness = 40 + (energy * 30)
    
    // Validate all gradient parameters
    if (!isFinite(centerX) || !isFinite(centerY) || !isFinite(radius) || radius <= 0) {
      return
    }
    
    const gradient = this.ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius
    )
    
    if (acousticness > 0.5) {
      gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness + 20}%, 0.8)`)
      gradient.addColorStop(0.7, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.4)`)
      gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness - 10}%, 0)`)
    } else {
      gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.9)`)
      gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness - 20}%, 0)`)
    }
    
    this.ctx.fillStyle = gradient
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    this.ctx.fill()
    
    if (danceability > 0.7) {
      const ringCount = Math.floor(danceability * 3) + 1
      for (let i = 1; i <= ringCount; i++) {
        const ringRadius = radius + (i * 20)
        const ringPulse = 1 + Math.sin(this.pulseTime * (tempo / 60) * 2 + i) * 0.05
        const finalRingRadius = ringRadius * ringPulse
        
        // Validate ring radius before drawing
        if (isFinite(finalRingRadius) && finalRingRadius > 0) {
          this.ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${0.3 / i})`
          this.ctx.lineWidth = 2
          this.ctx.beginPath()
          this.ctx.arc(centerX, centerY, finalRingRadius, 0, Math.PI * 2)
          this.ctx.stroke()
        }
      }
    }
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  resize(): void {
    this.setupCanvas()
  }

  private clamp(value: number, min: number, max: number): number {
    if (!isFinite(value)) return min
    return Math.max(min, Math.min(max, value))
  }
}