import * as THREE from 'three';
import type { Visualizer3D, QualityLevel, AudioData } from '../types';

interface Crystal {
  mesh: THREE.Mesh;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
  orbitAxis: THREE.Vector3;
  baseScale: number;
  targetScale: number;
  currentScale: number;
  bandIndex: number;
}

export class Crystalline implements Visualizer3D {
  name = 'Crystalline';

  private crystals: Crystal[] = [];
  private camera!: THREE.PerspectiveCamera;
  private lights: THREE.PointLight[] = [];
  private cameraAngle = 0;
  private beatPulse = 0;
  private smoothEnergy = 0;
  private burstParticles!: THREE.Points;
  private burstPositions!: Float32Array;
  private burstVelocities!: Float32Array;
  private burstLifetimes!: Float32Array;
  private burstCount = 200;

  init(scene: THREE.Scene, quality: QualityLevel): void {
    this.camera = scene.parent?.children.find(
      (c) => c instanceof THREE.PerspectiveCamera,
    ) as THREE.PerspectiveCamera;

    this.burstCount = quality === 'low' ? 100 : quality === 'medium' ? 200 : 400;

    // Create environment
    scene.background = new THREE.Color(0x050508);

    // Build 6 crystal shapes
    const geometries = [
      new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.DodecahedronGeometry(1.3, 0),
      new THREE.OctahedronGeometry(1.4, 0),
      new THREE.TetrahedronGeometry(1.2, 0),
      new THREE.IcosahedronGeometry(1.1, 2),
      new THREE.DodecahedronGeometry(0.9, 0),
    ];

    const orbits = [8, 10, 7, 12, 9, 11];
    const speeds = [0.3, 0.25, 0.35, 0.2, 0.4, 0.15];

    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setHSL(i / 6, 0.8, 0.5),
        transmission: 0.85,
        roughness: 0.05,
        metalness: 0.1,
        ior: 2.0,
        thickness: 0.5,
        transparent: true,
        opacity: 0.9,
        emissive: new THREE.Color().setHSL(i / 6, 1.0, 0.1),
        emissiveIntensity: 0.3,
      });

      const mesh = new THREE.Mesh(geometries[i], mat);
      scene.add(mesh);

      const axis = new THREE.Vector3(
        Math.random() - 0.5,
        1 + Math.random() * 0.5,
        Math.random() - 0.5,
      ).normalize();

      this.crystals.push({
        mesh,
        orbitRadius: orbits[i],
        orbitSpeed: speeds[i],
        orbitAngle: (i / 6) * Math.PI * 2,
        orbitAxis: axis,
        baseScale: 1,
        targetScale: 1,
        currentScale: 1,
        bandIndex: i,
      });
    }

    // Point lights that shift color
    const lightColors = [0xff4444, 0x44ff44, 0x4444ff, 0xff44ff];
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(lightColors[i], 2, 50);
      light.position.set(
        Math.cos((i / 4) * Math.PI * 2) * 15,
        5,
        Math.sin((i / 4) * Math.PI * 2) * 15,
      );
      scene.add(light);
      this.lights.push(light);
    }

    const ambient = new THREE.AmbientLight(0x222233, 0.5);
    scene.add(ambient);

    // Burst particles
    this.initBurstParticles(scene);

    if (this.camera) {
      this.camera.position.set(0, 10, 25);
      this.camera.lookAt(0, 0, 0);
    }
  }

  private initBurstParticles(scene: THREE.Scene): void {
    const geo = new THREE.BufferGeometry();
    this.burstPositions = new Float32Array(this.burstCount * 3);
    this.burstVelocities = new Float32Array(this.burstCount * 3);
    this.burstLifetimes = new Float32Array(this.burstCount);

    geo.setAttribute('position', new THREE.BufferAttribute(this.burstPositions, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.2,
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.burstParticles = new THREE.Points(geo, mat);
    scene.add(this.burstParticles);
  }

  private emitBurst(origin: THREE.Vector3): void {
    for (let i = 0; i < this.burstCount; i++) {
      if (this.burstLifetimes[i] <= 0) {
        this.burstPositions[i * 3] = origin.x;
        this.burstPositions[i * 3 + 1] = origin.y;
        this.burstPositions[i * 3 + 2] = origin.z;

        this.burstVelocities[i * 3] = (Math.random() - 0.5) * 2;
        this.burstVelocities[i * 3 + 1] = (Math.random() - 0.5) * 2;
        this.burstVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2;

        this.burstLifetimes[i] = 0.5 + Math.random() * 0.5;
        if (i > 20) break; // Emit ~20 per burst
      }
    }
  }

  update(data: AudioData, time: number, _delta: number): void {
    const bass = data.bass || 0;
    const mid = data.mid || 0;
    const treble = data.treble || 0;
    const energy = data.energy || 0;
    const isBeat = 'isBeat' in data && !!(data as { isBeat?: boolean }).isBeat;
    const bandValues = [bass, (bass + mid) / 2, mid, (mid + treble) / 2, treble, treble * 0.8];

    const lerp = THREE.MathUtils.lerp;
    this.smoothEnergy = lerp(this.smoothEnergy, energy, 0.1);

    if (isBeat) this.beatPulse = 1.0;
    this.beatPulse *= 0.88;

    // Update each crystal
    for (const crystal of this.crystals) {
      const bandVal = bandValues[crystal.bandIndex];

      // Audio-reactive scale
      crystal.targetScale = 0.5 + bandVal * 1.5 + this.beatPulse * 1.5;
      crystal.currentScale = lerp(crystal.currentScale, crystal.targetScale, 0.15);
      crystal.mesh.scale.setScalar(crystal.currentScale);

      // Orbit
      crystal.orbitAngle += crystal.orbitSpeed * 0.02 * (1 + this.smoothEnergy * 0.5);
      const pos = new THREE.Vector3(
        Math.cos(crystal.orbitAngle) * crystal.orbitRadius,
        Math.sin(crystal.orbitAngle * 0.7) * 3,
        Math.sin(crystal.orbitAngle) * crystal.orbitRadius,
      );
      crystal.mesh.position.copy(pos);

      // Self-rotation
      crystal.mesh.rotation.x += 0.01 + bandVal * 0.02;
      crystal.mesh.rotation.y += 0.015 + bandVal * 0.01;

      // Emissive intensity
      const mat = crystal.mesh.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity = 0.1 + bandVal * 1.5;

      // Emit particles on beat from random crystal
      if (isBeat && Math.random() > 0.5) {
        this.emitBurst(crystal.mesh.position);
      }
    }

    // Update burst particles
    const burstAttr = this.burstParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.burstCount; i++) {
      if (this.burstLifetimes[i] > 0) {
        this.burstLifetimes[i] -= 0.016;
        this.burstPositions[i * 3] += this.burstVelocities[i * 3] * 0.1;
        this.burstPositions[i * 3 + 1] += this.burstVelocities[i * 3 + 1] * 0.1;
        this.burstPositions[i * 3 + 2] += this.burstVelocities[i * 3 + 2] * 0.1;
        // Slow down
        this.burstVelocities[i * 3] *= 0.96;
        this.burstVelocities[i * 3 + 1] *= 0.96;
        this.burstVelocities[i * 3 + 2] *= 0.96;
      } else {
        // Hide dead particles far away
        this.burstPositions[i * 3 + 1] = -1000;
      }
    }
    burstAttr.needsUpdate = true;

    // Lights shift color with dominant band
    for (let i = 0; i < this.lights.length; i++) {
      const hue = (time * 0.05 + i * 0.25) % 1;
      this.lights[i].color.setHSL(hue, 0.9, 0.4 + this.smoothEnergy * 0.3);
      this.lights[i].intensity = 1 + bandValues[i] * 3;
    }

    // Camera orbit
    this.cameraAngle += 0.005 + this.smoothEnergy * 0.003;
    if (this.camera) {
      this.camera.position.x = Math.cos(this.cameraAngle) * 25;
      this.camera.position.z = Math.sin(this.cameraAngle) * 25;
      this.camera.position.y = 8 + Math.sin(time * 0.4) * 5;
      this.camera.lookAt(0, 0, 0);
    }
  }

  dispose(): void {
    for (const c of this.crystals) {
      c.mesh.geometry.dispose();
      (c.mesh.material as THREE.Material).dispose();
    }
    this.crystals = [];
    for (const l of this.lights) l.dispose();
    this.lights = [];
    this.burstParticles.geometry.dispose();
    (this.burstParticles.material as THREE.Material).dispose();
  }
}
