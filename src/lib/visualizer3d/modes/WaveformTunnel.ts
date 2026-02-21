import * as THREE from 'three';
import type { Visualizer3D, QualityLevel, AudioData } from '../types';

interface Ring {
  mesh: THREE.Line;
  z: number;
  basePositions: Float32Array;
}

export class WaveformTunnel implements Visualizer3D {
  name = 'Waveform Tunnel';

  private rings: Ring[] = [];
  private camera!: THREE.PerspectiveCamera;
  private ringCount = 100;
  private ringSegments = 64;
  private ringSpacing = 1.5;
  private baseRadius = 6;
  private smoothEnergy = 0;
  private smoothBass = 0;
  private smoothTreble = 0;
  private beatPulse = 0;
  private cameraZ = 0;
  private ringMaterial!: THREE.LineBasicMaterial;

  init(scene: THREE.Scene, quality: QualityLevel): void {
    this.ringCount = quality === 'low' ? 50 : quality === 'medium' ? 75 : 100;
    this.ringSegments = quality === 'low' ? 32 : 64;

    this.camera = scene.parent?.children.find(
      (c) => c instanceof THREE.PerspectiveCamera,
    ) as THREE.PerspectiveCamera;

    scene.background = new THREE.Color(0x020208);
    scene.fog = new THREE.FogExp2(0x020208, 0.015);

    this.ringMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Create rings along z-axis
    for (let i = 0; i < this.ringCount; i++) {
      const z = -i * this.ringSpacing;
      const ring = this.createRing(z);
      scene.add(ring.mesh);
      this.rings.push(ring);
    }

    // Central ambient light
    const point = new THREE.PointLight(0x4466ff, 1.5, 50);
    point.position.set(0, 0, 0);
    scene.add(point);

    this.cameraZ = 0;
    if (this.camera) {
      this.camera.position.set(0, 0, 5);
      this.camera.lookAt(0, 0, -50);
    }
  }

  private createRing(z: number): Ring {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array((this.ringSegments + 1) * 3);
    const basePositions = new Float32Array((this.ringSegments + 1) * 3);
    const colors = new Float32Array((this.ringSegments + 1) * 3);

    for (let i = 0; i <= this.ringSegments; i++) {
      const angle = (i / this.ringSegments) * Math.PI * 2;
      const x = Math.cos(angle) * this.baseRadius;
      const y = Math.sin(angle) * this.baseRadius;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;

      colors[i * 3] = 0.2;
      colors[i * 3 + 1] = 0.3;
      colors[i * 3 + 2] = 0.8;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mesh = new THREE.Line(geo, this.ringMaterial);
    return { mesh, z, basePositions };
  }

  update(data: AudioData, time: number, _delta: number): void {
    const bass = data.bass || 0;
    const mid = data.mid || 0;
    const treble = data.treble || 0;
    const energy = data.energy || 0;
    const isBeat = 'isBeat' in data && !!(data as { isBeat?: boolean }).isBeat;
    const timeDomain = data.timeDomain;

    const lerp = THREE.MathUtils.lerp;
    this.smoothEnergy = lerp(this.smoothEnergy, energy, 0.1);
    this.smoothBass = lerp(this.smoothBass, bass, 0.15);
    this.smoothTreble = lerp(this.smoothTreble, treble, 0.12);

    if (isBeat) this.beatPulse = 1.0;
    this.beatPulse *= 0.88;

    // Camera speed based on energy
    const speed = 0.3 + this.smoothEnergy * 1.5;
    this.cameraZ -= speed * 0.1;

    // Recycle rings
    const farZ = this.cameraZ - this.ringCount * this.ringSpacing;
    for (const ring of this.rings) {
      if (ring.z > this.cameraZ + 5) {
        ring.z = farZ;
        // Update base positions z
        const posAttr = ring.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const pos = posAttr.array as Float32Array;
        for (let i = 0; i <= this.ringSegments; i++) {
          ring.basePositions[i * 3 + 2] = ring.z;
          pos[i * 3 + 2] = ring.z;
        }
      }
    }

    // Beat contraction/expansion
    const beatRadiusMod = 1.0 - this.beatPulse * 0.3 + this.smoothBass * 0.4;

    // Update ring shapes
    for (let r = 0; r < this.rings.length; r++) {
      const ring = this.rings[r];
      const posAttr = ring.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = ring.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const colors = colAttr.array as Float32Array;

      // Depth from camera for color
      const depth = Math.abs(ring.z - this.cameraZ);
      const depthNorm = Math.min(depth / (this.ringCount * this.ringSpacing), 1);

      for (let i = 0; i <= this.ringSegments; i++) {
        const angle = (i / this.ringSegments) * Math.PI * 2;

        // Sample timeDomain data for radius modulation
        const tdIdx = Math.floor((i / this.ringSegments) * timeDomain.length);
        const tdVal = (timeDomain[tdIdx] - 128) / 128;

        // Star-shape morph based on treble
        const starMorph = 1 + Math.sin(angle * 5) * this.smoothTreble * 0.4;

        const radius =
          (this.baseRadius + tdVal * 3) * beatRadiusMod * starMorph;

        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = Math.sin(angle) * radius;

        // Color: hue cycles with depth + time, saturation from energy
        const hue = (depthNorm * 0.5 + time * 0.05) % 1;
        const sat = 0.5 + this.smoothEnergy * 0.5;
        const lightness = 0.3 + (1 - depthNorm) * 0.4;

        const c = new THREE.Color().setHSL(hue, sat, lightness);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // Camera: forward movement + slight sway
    if (this.camera) {
      this.camera.position.x = Math.sin(time * 1.5) * mid * 1.5;
      this.camera.position.y = Math.cos(time * 1.2) * mid * 1.0;
      this.camera.position.z = this.cameraZ + 5;
      this.camera.lookAt(
        Math.sin(time * 0.8) * 0.5,
        Math.cos(time * 0.6) * 0.5,
        this.cameraZ - 30,
      );
    }
  }

  dispose(): void {
    for (const ring of this.rings) {
      ring.mesh.geometry.dispose();
    }
    this.rings = [];
    this.ringMaterial.dispose();
  }
}
