import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { AudioData } from '../audio/AudioEngine';
import type { Visualizer3D, QualityLevel } from './types';

// --- Custom Chromatic Aberration Shader ---
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    amount: { value: 0.003 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec2 offset = amount * (vUv - 0.5);
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

// --- Custom Film Grain Shader ---
const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0.0 },
    amount: { value: 0.05 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float amount;
    varying vec2 vUv;
    float random(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float grain = random(vUv * time) * amount;
      gl_FragColor = vec4(color.rgb + grain, color.a);
    }
  `,
};

export class SceneManager {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;

  private bloomPass: UnrealBloomPass;
  private chromaPass: ShaderPass;
  private grainPass: ShaderPass;
  private currentMode: Visualizer3D | null = null;
  private quality: QualityLevel;
  private container: HTMLElement;
  private transitioning = false;
  private fadeOverlay: HTMLDivElement;

  constructor(container: HTMLElement, quality: QualityLevel = 'high') {
    this.container = container;
    this.quality = quality;

    // Renderer
    const antialias = quality !== 'low';
    this.renderer = new THREE.WebGLRenderer({
      antialias,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 0, 30);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      1.5, // strength
      0.4, // radius
      0.2, // threshold
    );

    this.chromaPass = new ShaderPass(ChromaticAberrationShader);
    this.grainPass = new ShaderPass(FilmGrainShader);

    // Apply quality-based passes
    this.applyQualityPasses();

    // Fade overlay for transitions
    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.style.cssText =
      'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity 0.4s ease;z-index:1;';
    container.style.position = 'relative';
    container.appendChild(this.fadeOverlay);

    window.addEventListener('resize', this.resize);
  }

  private applyQualityPasses(): void {
    // Remove all passes except RenderPass (index 0)
    while (this.composer.passes.length > 1) {
      this.composer.removePass(this.composer.passes[this.composer.passes.length - 1]);
    }

    if (this.quality === 'low') return; // no post-processing

    this.composer.addPass(this.bloomPass);

    if (this.quality === 'high') {
      this.composer.addPass(this.chromaPass);
      this.composer.addPass(this.grainPass);
    }
  }

  setMode(mode: Visualizer3D): void {
    if (this.transitioning) return;

    if (!this.currentMode) {
      // No transition needed for first mode
      this.currentMode = mode;
      mode.init(this.scene, this.quality);
      return;
    }

    this.transitioning = true;
    this.fadeOverlay.style.opacity = '1';

    setTimeout(() => {
      // Dispose old mode and clear scene
      this.currentMode?.dispose();
      this.clearScene();

      // Init new mode
      this.currentMode = mode;
      mode.init(this.scene, this.quality);

      // Fade in
      this.fadeOverlay.style.opacity = '0';
      setTimeout(() => {
        this.transitioning = false;
      }, 400);
    }, 400);
  }

  private clearScene(): void {
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      this.scene.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line) {
        child.geometry?.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat?.dispose();
      }
    }
    this.scene.fog = null;
    this.scene.background = null;
  }

  update(data: AudioData, time: number): void {
    if (!this.currentMode) return;

    // Update film grain time
    this.grainPass.uniforms['time'].value = time;

    // Audio-reactive post-processing
    const energy = data.energy || 0;
    this.bloomPass.strength = 1.0 + energy * 1.5;
    this.chromaPass.uniforms['amount'].value = 0.001 + energy * 0.004;

    this.currentMode.update(data, time, 0.016);
    this.composer.render();
  }

  setQuality(quality: QualityLevel): void {
    this.quality = quality;
    this.applyQualityPasses();
    if (this.currentMode) {
      this.currentMode.dispose();
      this.clearScene();
      this.currentMode.init(this.scene, quality);
    }
  }

  resize = (): void => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.currentMode?.dispose();
    this.clearScene();
    this.composer.dispose();
    this.renderer.dispose();
    this.fadeOverlay.remove();
    this.renderer.domElement.remove();
  }
}
