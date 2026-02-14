import type { Visualizer, ThemeColors } from './types';
import type { AudioData } from '../audio/AudioEngine';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  life: number;
  maxLife: number;
  hueOffset: number;
  band: 'bass' | 'mid' | 'treble';
}

export class ParticleGalaxy implements Visualizer {
  private particles: Particle[] = [];
  private maxParticles = 800;

  private spawn(w: number, h: number, band: 'bass' | 'mid' | 'treble', intensity: number): void {
    if (this.particles.length >= this.maxParticles) return;
    const cx = w / 2, cy = h / 2;
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 60;
    const speed = 0.5 + intensity * 3;

    this.particles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 0.5,
      vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 0.5,
      size: 1 + Math.random() * 3 + intensity * 2,
      life: 0,
      maxLife: 100 + Math.random() * 150,
      hueOffset: Math.random() * 60 - 30,
      band,
    });
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, data: AudioData, theme: ThemeColors, time: number): void {
    const { bass, mid, treble, energy } = data;

    // Fade background
    ctx.fillStyle = theme.bg + 'e0';
    ctx.fillRect(0, 0, w, h);

    // Spawn based on audio
    const spawnRate = Math.floor(energy * 15) + 2;
    for (let i = 0; i < spawnRate; i++) {
      if (bass > 0.2) this.spawn(w, h, 'bass', bass);
      if (mid > 0.15) this.spawn(w, h, 'mid', mid);
      if (treble > 0.1) this.spawn(w, h, 'treble', treble);
    }

    const cx = w / 2, cy = h / 2;

    // Central glow
    const glowR = 80 + energy * 120 + Math.sin(time * 2) * 20;
    const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glowGrad.addColorStop(0, theme.primary + '40');
    glowGrad.addColorStop(0.5, theme.secondary + '15');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Update and draw particles
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life++;
      if (p.life > p.maxLife) continue;

      // Spiral force
      const dx = p.x - cx, dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const angle = Math.atan2(dy, dx);
      const spiralForce = 0.02 + energy * 0.03;
      p.vx += Math.cos(angle + Math.PI / 2) * spiralForce - dx * 0.0001;
      p.vy += Math.sin(angle + Math.PI / 2) * spiralForce - dy * 0.0001;

      // Band-specific boost
      const bandVal = p.band === 'bass' ? bass : p.band === 'mid' ? mid : treble;
      const boost = 1 + bandVal * 0.5;
      p.vx *= 0.99 * boost;
      p.vy *= 0.99 * boost;

      p.x += p.vx;
      p.y += p.vy;

      const lifeRatio = p.life / p.maxLife;
      const alpha = lifeRatio < 0.1 ? lifeRatio * 10 : lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1;
      const size = p.size * (1 + bandVal * 0.5);

      const colorIdx = p.band === 'bass' ? 0 : p.band === 'mid' ? 2 : 4;
      const color = theme.colors[colorIdx % theme.colors.length];

      ctx.globalAlpha = alpha * 0.8;

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Connecting lines to nearby particles
      if (dist < 200 && alpha > 0.3) {
        for (let j = alive.length - 1; j >= Math.max(0, alive.length - 5); j--) {
          const other = alive[j];
          const ddx = p.x - other.x, ddy = p.y - other.y;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < 60) {
            ctx.globalAlpha = (1 - d / 60) * 0.15 * alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      }

      alive.push(p);
    }
    this.particles = alive;
    ctx.globalAlpha = 1;
  }
}
