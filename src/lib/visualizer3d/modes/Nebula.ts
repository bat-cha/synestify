import * as THREE from 'three';
import type { Visualizer3D, QualityLevel, AudioData } from '../types';

export class Nebula implements Visualizer3D {
  name = 'Nebula';

  private particles!: THREE.Points;
  private positions!: Float32Array;
  private basePositions!: Float32Array;
  private colors!: Float32Array;
  private sizes!: Float32Array;
  private velocities!: Float32Array;
  private count = 0;
  private camera!: THREE.PerspectiveCamera;
  private cameraAngle = 0;
  private cameraRadius = 35;
  private starField!: THREE.Mesh;
  private ambientParticles!: THREE.Points;
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothTreble = 0;
  private smoothEnergy = 0;
  private beatPulse = 0;

  init(scene: THREE.Scene, quality: QualityLevel): void {
    this.count =
      quality === 'low' ? 5000 : quality === 'medium' ? 15000 : 30000;

    // Find camera in scene's parent (will be set externally via update)
    this.camera = scene.parent?.children.find(
      (c) => c instanceof THREE.PerspectiveCamera,
    ) as THREE.PerspectiveCamera;

    // --- Main particle cloud ---
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    this.basePositions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);
    this.velocities = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      // Spherical distribution with density falloff
      const r = Math.pow(Math.random(), 0.5) * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;

      this.basePositions[i * 3] = x;
      this.basePositions[i * 3 + 1] = y;
      this.basePositions[i * 3 + 2] = z;

      // Warm default color
      this.colors[i * 3] = 0.3 + Math.random() * 0.4;
      this.colors[i * 3 + 1] = 0.1 + Math.random() * 0.2;
      this.colors[i * 3 + 2] = 0.5 + Math.random() * 0.5;

      this.sizes[i] = 0.5 + Math.random() * 1.5;

      // Slow drift velocities
      this.velocities[i * 3] = (Math.random() - 0.5) * 0.01;
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, mat);
    scene.add(this.particles);

    // --- Star field background ---
    this.createStarField(scene, quality);

    // --- Ambient dust particles ---
    this.createAmbientParticles(scene, quality);
  }

  private createStarField(scene: THREE.Scene, quality: QualityLevel): void {
    const starCount = quality === 'low' ? 500 : quality === 'medium' ? 1000 : 2000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const r = 150 + Math.random() * 100;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.3,
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.starField = new THREE.Points(starGeo, starMat) as unknown as THREE.Mesh;
    scene.add(this.starField);
  }

  private createAmbientParticles(scene: THREE.Scene, quality: QualityLevel): void {
    const count = quality === 'low' ? 200 : 500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.15,
      color: 0x8888ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ambientParticles = new THREE.Points(geo, mat);
    scene.add(this.ambientParticles);
  }

  update(data: AudioData, time: number): void {
    const bass = data.bass || 0;
    const mid = data.mid || 0;
    const treble = data.treble || 0;
    const energy = data.energy || 0;
    const isBeat = 'isBeat' in data && !!(data as { isBeat?: boolean }).isBeat;

    // Smooth values
    const lerp = THREE.MathUtils.lerp;
    this.smoothBass = lerp(this.smoothBass, bass, 0.15);
    this.smoothMid = lerp(this.smoothMid, mid, 0.12);
    this.smoothTreble = lerp(this.smoothTreble, treble, 0.12);
    this.smoothEnergy = lerp(this.smoothEnergy, energy, 0.1);

    // Beat pulse
    if (isBeat) this.beatPulse = 1.0;
    this.beatPulse *= 0.92;

    const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.particles.geometry.getAttribute('color') as THREE.BufferAttribute;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      // Base position + audio displacement
      const bx = this.basePositions[i3];
      const by = this.basePositions[i3 + 1];
      const bz = this.basePositions[i3 + 2];

      const dist = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
      const nx = bx / dist;
      const ny = by / dist;
      const nz = bz / dist;

      // Bass expands outward, beat pulse adds sharp burst
      const expand = this.smoothBass * 5 + this.beatPulse * 8;

      this.positions[i3] = bx + nx * expand + this.velocities[i3] * time;
      this.positions[i3 + 1] = by + ny * expand + this.velocities[i3 + 1] * time;
      this.positions[i3 + 2] = bz + nz * expand + this.velocities[i3 + 2] * time;

      // Color: bass→warm, treble→cool
      const warmth = this.smoothBass - this.smoothTreble;
      if (warmth > 0) {
        // Warm: orange-red
        this.colors[i3] = 0.8 + warmth * 0.2;
        this.colors[i3 + 1] = 0.2 + warmth * 0.3;
        this.colors[i3 + 2] = 0.1;
      } else {
        // Cool: cyan-blue
        this.colors[i3] = 0.1;
        this.colors[i3 + 1] = 0.3 + Math.abs(warmth) * 0.4;
        this.colors[i3 + 2] = 0.7 + Math.abs(warmth) * 0.3;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    // Treble → particle size
    (this.particles.material as THREE.PointsMaterial).size =
      0.6 + this.smoothTreble * 2.0;

    // Energy → opacity
    (this.particles.material as THREE.PointsMaterial).opacity =
      0.5 + this.smoothEnergy * 0.5;

    // Mid → cloud rotation
    this.particles.rotation.y += 0.002 + this.smoothMid * 0.01;
    this.particles.rotation.x += 0.001;

    // Camera orbit
    this.cameraAngle += 0.003 + this.smoothMid * 0.005;
    const camDist = this.cameraRadius + Math.sin(time * 0.5) * 3 - this.smoothBass * 5;
    if (this.camera) {
      this.camera.position.x = Math.cos(this.cameraAngle) * camDist;
      this.camera.position.z = Math.sin(this.cameraAngle) * camDist;
      this.camera.position.y = Math.sin(time * 0.3) * 8;
      this.camera.lookAt(0, 0, 0);
    }

    // Ambient particle drift
    if (this.ambientParticles) {
      this.ambientParticles.rotation.y += 0.0005;
      this.ambientParticles.rotation.x += 0.0003;
    }
  }

  dispose(): void {
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
    if (this.starField) {
      (this.starField as unknown as THREE.Points).geometry.dispose();
      ((this.starField as unknown as THREE.Points).material as THREE.Material).dispose();
    }
    if (this.ambientParticles) {
      this.ambientParticles.geometry.dispose();
      (this.ambientParticles.material as THREE.Material).dispose();
    }
  }
}
