import type { AudioData } from '../audio/AudioEngine';
import type { ThemeColors } from '../visualizer/types';
import type * as THREE from 'three';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface Visualizer3D {
  name: string;
  init(scene: THREE.Scene, quality: QualityLevel): void;
  update(data: AudioData, time: number, delta: number): void;
  setTheme?(colors: ThemeColors): void;
  dispose(): void;
}

export type { AudioData, ThemeColors };
