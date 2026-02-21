import * as THREE from 'three';
import type { Visualizer3D, QualityLevel, AudioData } from '../types';

export class Terrain implements Visualizer3D {
  name = 'Terrain';

  private plane!: THREE.Mesh;
  private positions!: Float32Array;
  private segW = 128;
  private segH = 128;
  private camera!: THREE.PerspectiveCamera;
  private cameraZ = 0;
  private light!: THREE.DirectionalLight;
  private scene!: THREE.Scene;
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothEnergy = 0;
  private beatPulse = 0;

  init(scene: THREE.Scene, quality: QualityLevel): void {
    this.scene = scene;
    this.segW = quality === 'low' ? 64 : quality === 'medium' ? 96 : 128;
    this.segH = this.segW;

    this.camera = scene.parent?.children.find(
      (c) => c instanceof THREE.PerspectiveCamera,
    ) as THREE.PerspectiveCamera;

    // Terrain mesh
    const geo = new THREE.PlaneGeometry(60, 60, this.segW, this.segH);
    geo.rotateX(-Math.PI / 2);

    this.positions = geo.getAttribute('position').array as Float32Array;

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      wireframe: false,
      metalness: 0.2,
      roughness: 0.7,
      flatShading: true,
    });

    // Add vertex colors
    const colorArray = new Float32Array(this.positions.length);
    geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    this.plane = new THREE.Mesh(geo, mat);
    scene.add(this.plane);

    // Lighting
    this.light = new THREE.DirectionalLight(0xffffff, 1.2);
    this.light.position.set(10, 20, 10);
    scene.add(this.light);

    const hemi = new THREE.HemisphereLight(0x4444ff, 0x222200, 0.5);
    scene.add(hemi);

    // Fog
    scene.fog = new THREE.FogExp2(0x050510, 0.025);
    scene.background = new THREE.Color(0x050510);

    // Reset camera
    this.cameraZ = 0;
    if (this.camera) {
      this.camera.position.set(0, 12, 25);
      this.camera.lookAt(0, 0, -10);
    }
  }

  update(data: AudioData, time: number): void {
    const bass = data.bass || 0;
    const mid = data.mid || 0;
    const energy = data.energy || 0;
    const isBeat = 'isBeat' in data && !!(data as { isBeat?: boolean }).isBeat;

    const lerp = THREE.MathUtils.lerp;
    this.smoothBass = lerp(this.smoothBass, bass, 0.15);
    this.smoothMid = lerp(this.smoothMid, mid, 0.12);
    this.smoothEnergy = lerp(this.smoothEnergy, energy, 0.1);

    if (isBeat) this.beatPulse = 1.0;
    this.beatPulse *= 0.9;

    const freq = data.frequency;
    const posAttr = this.plane.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.plane.geometry.getAttribute('color') as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const colors = colAttr.array as Float32Array;

    const cols = this.segW + 1;
    const rows = this.segH + 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const i3 = idx * 3;

        // Map columns to frequency bins
        const freqIdx = Math.floor((col / cols) * freq.length);
        const freqVal = freq[freqIdx] / 255;

        // Height from frequency + some wave motion
        const wave = Math.sin(time * 2 + col * 0.1 + row * 0.05) * 0.5;
        const beatBoost = this.beatPulse * 3;
        const height = freqVal * 8 + wave + beatBoost * freqVal;

        positions[i3 + 1] = height; // Y is up

        // Height-based coloring
        const h = height / 10;
        if (h < 0.2) {
          // Low: deep purple
          colors[i3] = 0.1;
          colors[i3 + 1] = 0.05;
          colors[i3 + 2] = 0.3;
        } else if (h < 0.5) {
          // Mid: teal
          colors[i3] = 0.0;
          colors[i3 + 1] = 0.3 + h * 0.4;
          colors[i3 + 2] = 0.3 + h * 0.2;
        } else {
          // High: bright white/emissive
          colors[i3] = 0.5 + h * 0.5;
          colors[i3 + 1] = 0.5 + h * 0.5;
          colors[i3 + 2] = 0.6 + h * 0.4;
        }
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.plane.geometry.computeVertexNormals();

    // Camera: fly forward, bob with bass
    this.cameraZ -= 0.05 + this.smoothEnergy * 0.1;
    if (this.camera) {
      this.camera.position.set(
        Math.sin(time * 0.3) * 5,
        10 + this.smoothBass * 5,
        25 + Math.sin(time * 0.2) * 5,
      );
      this.camera.lookAt(
        Math.sin(time * 0.2) * 3,
        2 + this.smoothMid * 3,
        -10,
      );
    }

    // Light color shifts with energy
    this.light.color.setHSL(0.6 + this.smoothEnergy * 0.2, 0.8, 0.6);

    // Fog density inversely proportional to energy
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = 0.035 - this.smoothEnergy * 0.02;
    }
  }

  dispose(): void {
    this.plane.geometry.dispose();
    (this.plane.material as THREE.Material).dispose();
    this.light.dispose();
  }
}
