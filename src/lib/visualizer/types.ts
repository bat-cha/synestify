import type { AudioData, TrackInfo } from '../audio/AudioEngine';
export type { AudioData, TrackInfo };

export type VisualizerMode = 'ocean' | 'spectrum' | 'galaxy' | 'synesthesia' | 'geometric';

export type ColorTheme = 'neon' | 'sunset' | 'ocean' | 'monochrome';

export interface ThemeColors {
  bg: string;
  primary: string;
  secondary: string;
  accent: string;
  colors: string[];
}

export const THEMES: Record<ColorTheme, ThemeColors> = {
  neon: {
    bg: '#0a0a0f',
    primary: '#00ffff',
    secondary: '#ff00ff',
    accent: '#ffff00',
    colors: ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff6600', '#ff0066'],
  },
  sunset: {
    bg: '#1a0a05',
    primary: '#ff6b35',
    secondary: '#ff2e63',
    accent: '#ffd700',
    colors: ['#ff6b35', '#ff2e63', '#ffd700', '#ff8c00', '#dc143c', '#ff4500'],
  },
  ocean: {
    bg: '#020a18',
    primary: '#0099ff',
    secondary: '#00ccaa',
    accent: '#66ddff',
    colors: ['#0044ff', '#0099ff', '#00ccaa', '#00ffcc', '#3366ff', '#66ddff'],
  },
  monochrome: {
    bg: '#0a0a0a',
    primary: '#ffffff',
    secondary: '#aaaaaa',
    accent: '#666666',
    colors: ['#ffffff', '#cccccc', '#999999', '#666666', '#444444', '#dddddd'],
  },
};

export interface Visualizer {
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, data: AudioData, theme: ThemeColors, time: number): void;
}
