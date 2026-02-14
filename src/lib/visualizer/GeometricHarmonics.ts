import type { Visualizer, ThemeColors } from './types';
import type { AudioData } from '../audio/AudioEngine';

/**
 * Sacred geometry — mandalas, spirals, circles that pulse with music.
 */
export class GeometricHarmonics implements Visualizer {
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, data: AudioData, theme: ThemeColors, time: number): void {
    const { frequency, bass, mid, treble, energy } = data;
    const cx = w / 2, cy = h / 2;
    const minDim = Math.min(w, h);

    // Background
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // Slow rotation
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.1);

    // === Outer ring of circles (mandala) ===
    const ringCount = 3;
    for (let ring = 0; ring < ringCount; ring++) {
      const ringR = minDim * (0.15 + ring * 0.12) + bass * 30;
      const count = 12 + ring * 6;
      const bandVal = ring === 0 ? bass : ring === 1 ? mid : treble;
      const sizeBase = 5 + bandVal * 20;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + time * (0.2 + ring * 0.1) * (ring % 2 === 0 ? 1 : -1);
        const pulse = 1 + Math.sin(time * 3 + i * 0.5) * 0.2 * energy;
        const r = ringR * pulse;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const size = sizeBase * (0.5 + bandVal * 0.5);

        const colorIdx = (ring * 2 + Math.floor(i / 3)) % theme.colors.length;
        const color = theme.colors[colorIdx];

        ctx.globalAlpha = 0.4 + bandVal * 0.4;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = size;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Connecting lines to center
        ctx.globalAlpha = 0.05 + bandVal * 0.1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }

    // === Spirals ===
    const spiralCount = 3;
    for (let s = 0; s < spiralCount; s++) {
      ctx.beginPath();
      const points = 200;
      const baseAngle = (s / spiralCount) * Math.PI * 2;
      ctx.globalAlpha = 0.3 + energy * 0.3;

      for (let i = 0; i < points; i++) {
        const t = i / points;
        const angle = baseAngle + t * Math.PI * 6 + time * 0.5;
        const r = t * minDim * 0.4 * (1 + mid * 0.3);
        const freqIdx = Math.floor(t * frequency.length * 0.5);
        const freqVal = frequency[freqIdx] / 255;
        const wobble = Math.sin(time * 2 + i * 0.1) * freqVal * 15;
        const x = Math.cos(angle) * (r + wobble);
        const y = Math.sin(angle) * (r + wobble);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = theme.colors[s * 2 % theme.colors.length];
      ctx.lineWidth = 1.5 + energy * 2;
      ctx.stroke();
    }

    // === Central flower of life ===
    const petalCount = 6;
    const petalR = minDim * 0.08 + energy * 20;
    ctx.globalAlpha = 0.2 + bass * 0.3;
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const px = Math.cos(angle) * petalR;
      const py = Math.sin(angle) * petalR;
      ctx.beginPath();
      ctx.arc(px, py, petalR, 0, Math.PI * 2);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 1 + energy;
      ctx.stroke();
    }
    // Center circle
    ctx.beginPath();
    ctx.arc(0, 0, petalR, 0, Math.PI * 2);
    ctx.strokeStyle = theme.secondary;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Core pulse
    const coreR = 10 + bass * 40 + Math.sin(time * 4) * 5;
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
    coreGrad.addColorStop(0, theme.accent + 'cc');
    coreGrad.addColorStop(1, theme.accent + '00');
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
