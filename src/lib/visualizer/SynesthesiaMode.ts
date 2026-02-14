import type { Visualizer, ThemeColors } from './types';
import type { AudioData } from '../audio/AudioEngine';

/**
 * Synesthesia — maps frequencies to colours and paints abstract art.
 * Bass=warm(red/orange), Mid=cool(green/cyan), Treble=bright(blue/violet)
 */
export class SynesthesiaMode implements Visualizer {
  private canvas: HTMLCanvasElement | null = null;
  private persistCtx: CanvasRenderingContext2D | null = null;

  private ensurePersist(w: number, h: number): CanvasRenderingContext2D {
    if (!this.canvas || this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = w;
      this.canvas.height = h;
      this.persistCtx = this.canvas.getContext('2d')!;
      this.persistCtx.fillStyle = '#000';
      this.persistCtx.fillRect(0, 0, w, h);
    }
    return this.persistCtx!;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, data: AudioData, _theme: ThemeColors, time: number): void {
    const { frequency, bass, energy } = data;
    const pCtx = this.ensurePersist(w, h);

    // Slowly fade the persistent canvas
    pCtx.fillStyle = 'rgba(0,0,0,0.02)';
    pCtx.fillRect(0, 0, w, h);

    const binCount = frequency.length;
    const cx = w / 2, cy = h / 2;

    // Paint strokes based on frequency bands
    const strokes = Math.floor(5 + energy * 20);
    for (let i = 0; i < strokes; i++) {
      const binIdx = Math.floor(Math.random() * binCount * 0.8);
      const value = frequency[binIdx] / 255;
      if (value < 0.1) continue;

      const freqRatio = binIdx / binCount;

      // Map frequency to color: low=red, mid=green, high=blue/violet
      let r: number, g: number, b: number;
      if (freqRatio < 0.15) {
        // Bass → red/orange
        r = 200 + value * 55;
        g = Math.floor(value * 100);
        b = Math.floor(value * 30);
      } else if (freqRatio < 0.5) {
        // Mid → green/cyan
        r = Math.floor(value * 50);
        g = 150 + value * 105;
        b = Math.floor(100 + value * 100);
      } else {
        // Treble → blue/violet
        r = Math.floor(100 + value * 80);
        g = Math.floor(value * 50);
        b = 180 + value * 75;
      }

      const angle = time * 0.3 + binIdx * 0.1 + Math.random() * 0.5;
      const dist = 50 + value * Math.min(w, h) * 0.35 + Math.random() * 50;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const size = 5 + value * 40;

      pCtx.globalAlpha = 0.3 + value * 0.5;
      const grad = pCtx.createRadialGradient(x, y, 0, x, y, size);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.8)`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},0.2)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      pCtx.fillStyle = grad;
      pCtx.beginPath();
      pCtx.arc(x, y, size, 0, Math.PI * 2);
      pCtx.fill();
    }

    // Flowing paint streaks
    if (energy > 0.2) {
      const streakCount = Math.floor(energy * 5);
      for (let s = 0; s < streakCount; s++) {
        const startAngle = time * 0.5 + s * Math.PI * 2 / streakCount;
        pCtx.beginPath();
        pCtx.globalAlpha = 0.1 + energy * 0.15;
        for (let j = 0; j < 50; j++) {
          const t = j / 50;
          const r = 30 + t * Math.min(w, h) * 0.4;
          const a = startAngle + t * 2 + Math.sin(time + j * 0.1) * 0.3;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          if (j === 0) pCtx.moveTo(px, py);
          else pCtx.lineTo(px, py);
        }
        const hue = ((s / streakCount) * 360 + time * 30) % 360;
        pCtx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.4)`;
        pCtx.lineWidth = 2 + bass * 4;
        pCtx.stroke();
      }
    }

    pCtx.globalAlpha = 1;

    // Draw persistent canvas to main
    ctx.drawImage(this.canvas!, 0, 0);

    // Live frequency overlay ring
    ctx.globalAlpha = 0.6;
    const ringR = Math.min(w, h) * 0.15;
    for (let i = 0; i < 360; i += 2) {
      const binIdx = Math.floor((i / 360) * binCount * 0.5);
      const value = frequency[binIdx] / 255;
      const angle = (i * Math.PI) / 180;
      const r = ringR + value * ringR;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      const hue = i;
      ctx.fillStyle = `hsla(${hue}, 80%, ${50 + value * 30}%, ${0.3 + value * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + value * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
