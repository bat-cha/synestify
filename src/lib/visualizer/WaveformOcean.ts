import type { Visualizer, ThemeColors } from './types';
import type { AudioData } from '../audio/AudioEngine';

export class WaveformOcean implements Visualizer {
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, data: AudioData, theme: ThemeColors, time: number): void {
    const { timeDomain, bass, mid, treble, energy } = data;
    const len = timeDomain.length;

    // Sky/water background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, theme.bg);
    bgGrad.addColorStop(0.4, theme.bg);
    bgGrad.addColorStop(1, theme.colors[0] + '30');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Draw multiple wave layers
    const layers = 6;
    for (let layer = 0; layer < layers; layer++) {
      const layerRatio = layer / layers;
      const yBase = h * 0.35 + layerRatio * h * 0.55;
      const amplitude = (30 + bass * 80) * (1 - layerRatio * 0.5);
      const speed = time * (0.3 + layerRatio * 0.2);
      const freq = 0.003 + layerRatio * 0.002;
      const alpha = 0.15 + (1 - layerRatio) * 0.25;

      const colorIdx = layer % theme.colors.length;
      const color = theme.colors[colorIdx];

      ctx.beginPath();
      ctx.moveTo(0, h);

      for (let x = 0; x <= w; x += 2) {
        const dataIdx = Math.floor((x / w) * len);
        const waveVal = (timeDomain[dataIdx] - 128) / 128;
        
        const y = yBase
          + Math.sin(x * freq + speed) * amplitude
          + Math.sin(x * freq * 2.3 + speed * 1.7) * amplitude * 0.3
          + waveVal * 40 * energy * (1 - layerRatio * 0.7);

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, yBase - amplitude, 0, h);
      grad.addColorStop(0, color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
      grad.addColorStop(1, color + '05');
      ctx.fillStyle = grad;
      ctx.fill();

      // Glow line on top
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const dataIdx = Math.floor((x / w) * len);
        const waveVal = (timeDomain[dataIdx] - 128) / 128;
        const y = yBase
          + Math.sin(x * freq + speed) * amplitude
          + Math.sin(x * freq * 2.3 + speed * 1.7) * amplitude * 0.3
          + waveVal * 40 * energy * (1 - layerRatio * 0.7);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + Math.round(alpha * 1.5 * 255).toString(16).padStart(2, '0').slice(0, 2);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Floating particles (foam/stars)
    const particleCount = Math.floor(20 + energy * 40);
    for (let i = 0; i < particleCount; i++) {
      const seed = i * 7919;
      const px = ((seed * 13) % w + time * (10 + (seed % 20))) % w;
      const py = h * 0.3 + ((seed * 31) % (h * 0.6)) + Math.sin(time + i) * 10 * mid;
      const size = 1 + (seed % 3) + treble * 2;
      const a = 0.2 + energy * 0.5;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fillStyle = theme.primary + Math.round(a * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }
  }
}
