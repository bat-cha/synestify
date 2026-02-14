import type { Visualizer, ThemeColors } from './types';
import type { AudioData } from '../audio/AudioEngine';

export class FrequencySpectrum implements Visualizer {
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, data: AudioData, theme: ThemeColors, time: number): void {
    const { frequency, energy, bass } = data;

    // Background
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    const barCount = 128;
    const gap = 2;
    const barWidth = (w - gap * barCount) / barCount;
    const maxBarH = h * 0.75;

    for (let i = 0; i < barCount; i++) {
      const dataIdx = Math.floor((i / barCount) * frequency.length * 0.7); // focus on lower frequencies
      const value = frequency[dataIdx] / 255;
      const barH = value * maxBarH;

      const x = i * (barWidth + gap);
      const y = h - barH;

      // Color gradient per bar based on position
      const ratio = i / barCount;
      const colorIdx = Math.floor(ratio * (theme.colors.length - 1));
      const nextIdx = Math.min(colorIdx + 1, theme.colors.length - 1);
      const c1 = theme.colors[colorIdx];
      const c2 = theme.colors[nextIdx];

      // Bar gradient (vertical)
      const grad = ctx.createLinearGradient(x, y, x, h);
      grad.addColorStop(0, c2);
      grad.addColorStop(1, c1 + '80');
      ctx.fillStyle = grad;

      // Rounded top bars
      const radius = Math.min(barWidth / 2, 4);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, h);
      ctx.lineTo(x, h);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.fill();

      // Glow effect on top
      if (value > 0.5) {
        ctx.shadowColor = c2;
        ctx.shadowBlur = 15 * value;
        ctx.fillStyle = c2 + 'cc';
        ctx.fillRect(x, y, barWidth, 3);
        ctx.shadowBlur = 0;
      }

      // Reflection (mirror below)
      const reflGrad = ctx.createLinearGradient(x, h, x, h + barH * 0.4);
      reflGrad.addColorStop(0, c1 + '40');
      reflGrad.addColorStop(1, c1 + '00');
      ctx.fillStyle = reflGrad;
      ctx.fillRect(x, h, barWidth, barH * 0.4);
    }

    // Ambient glow at bottom
    const ambientGrad = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, w * 0.6);
    ambientGrad.addColorStop(0, theme.primary + Math.round(energy * 60).toString(16).padStart(2, '0'));
    ambientGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, w, h);

    // Bass pulse circle in center
    if (bass > 0.3) {
      const pulseR = 50 + bass * 100 + Math.sin(time * 4) * 10;
      const pulseGrad = ctx.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, pulseR);
      pulseGrad.addColorStop(0, theme.secondary + '30');
      pulseGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = pulseGrad;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.3, pulseR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
