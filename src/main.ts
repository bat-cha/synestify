import './style.css';
import { AudioEngine } from './lib/audio/AudioEngine';
import { WaveformOcean } from './lib/visualizer/WaveformOcean';
import { FrequencySpectrum } from './lib/visualizer/FrequencySpectrum';
import { ParticleGalaxy } from './lib/visualizer/ParticleGalaxy';
import { SynesthesiaMode } from './lib/visualizer/SynesthesiaMode';
import { GeometricHarmonics } from './lib/visualizer/GeometricHarmonics';
import { THEMES, type VisualizerMode, type ColorTheme, type Visualizer } from './lib/visualizer/types';

// ===== State =====
let currentMode: VisualizerMode = 'galaxy';
let currentTheme: ColorTheme = 'neon';
let sensitivity = 1;
let time = 0;
let running = false;
const engine = new AudioEngine();
const visualizers: Record<VisualizerMode, Visualizer> = {
  ocean: new WaveformOcean(),
  spectrum: new FrequencySpectrum(),
  galaxy: new ParticleGalaxy(),
  synesthesia: new SynesthesiaMode(),
  geometric: new GeometricHarmonics(),
};

// ===== DOM =====
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <canvas id="main-canvas"></canvas>

  <div class="welcome" id="welcome">
    <h1>Synestify</h1>
    <p>Choose a source below to begin</p>
  </div>

  <div class="overlay">
    <div class="top-bar">
      <div class="logo">Synestify</div>
      <div class="top-actions">
        <button class="btn btn-icon" id="btn-fullscreen" title="Fullscreen">⛶</button>
      </div>
    </div>

    <div></div>

    <div class="bottom-bar">
      <div class="playback-row" id="playback-row">
        <button class="btn btn-icon" id="btn-play-pause">⏸</button>
        <span class="playback-time" id="time-current">0:00</span>
        <div class="progress-bar" id="progress-bar">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
        <span class="playback-time" id="time-total">0:00</span>
      </div>

      <div class="source-row">
        <span class="label">Source:</span>
        <button class="btn" id="btn-mic">🎤 Mic</button>
        <button class="btn" id="btn-file">📁 File</button>
        <button class="btn" id="btn-demo">🎵 Demo</button>
        <input type="file" id="file-input" accept="audio/*" />
      </div>

      <div class="mode-row" id="mode-row">
        <button class="mode-btn" data-mode="ocean">🌊 Ocean</button>
        <button class="mode-btn" data-mode="spectrum">📊 Spectrum</button>
        <button class="mode-btn active" data-mode="galaxy">🌌 Galaxy</button>
        <button class="mode-btn" data-mode="synesthesia">🎨 Synesthesia</button>
        <button class="mode-btn" data-mode="geometric">✡ Geometry</button>
      </div>

      <div class="controls-row">
        <div class="control-group">
          <label>Sensitivity</label>
          <input type="range" id="sensitivity" min="0.2" max="3" step="0.1" value="1" />
        </div>
        <div class="control-group">
          <label>Theme</label>
          <div class="theme-pills">
            <div class="theme-pill neon active" data-theme="neon"></div>
            <div class="theme-pill sunset" data-theme="sunset"></div>
            <div class="theme-pill ocean" data-theme="ocean"></div>
            <div class="theme-pill monochrome" data-theme="monochrome"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="drop-zone" id="drop-zone">
    <h2>Drop audio file here</h2>
    <p>MP3, WAV, OGG, FLAC</p>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#main-canvas')!;
const ctx = canvas.getContext('2d')!;
const welcome = document.getElementById('welcome')!;
const playbackRow = document.getElementById('playback-row')!;
const progressFill = document.getElementById('progress-fill')!;
const timeCurrent = document.getElementById('time-current')!;
const timeTotal = document.getElementById('time-total')!;
const btnPlayPause = document.getElementById('btn-play-pause')!;
const dropZone = document.getElementById('drop-zone')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

// ===== Canvas sizing =====
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

// ===== Source buttons =====
const btnMic = document.getElementById('btn-mic')!;
const btnFile = document.getElementById('btn-file')!;
const btnDemo = document.getElementById('btn-demo')!;

function clearSourceActive() {
  btnMic.classList.remove('active');
  btnFile.classList.remove('active');
  btnDemo.classList.remove('active');
  playbackRow.classList.remove('visible');
}

btnMic.addEventListener('click', async () => {
  clearSourceActive();
  btnMic.classList.add('active');
  try {
    await engine.startMic();
    startVis();
  } catch (e) {
    console.error('Mic access denied:', e);
    btnMic.classList.remove('active');
  }
});

btnFile.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  await loadFile(file);
});

async function loadFile(file: File) {
  clearSourceActive();
  btnFile.classList.add('active');
  const audio = await engine.startFile(file);
  playbackRow.classList.add('visible');

  audio.addEventListener('loadedmetadata', () => {
    timeTotal.textContent = formatTime(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    timeCurrent.textContent = formatTime(audio.currentTime);
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    progressFill.style.width = pct + '%';
  });
  audio.addEventListener('ended', () => {
    btnPlayPause.textContent = '▶';
  });

  btnPlayPause.textContent = '⏸';
  startVis();
}

btnPlayPause.addEventListener('click', () => {
  const audio = engine.getAudioElement();
  if (!audio) return;
  if (audio.paused) {
    audio.play();
    btnPlayPause.textContent = '⏸';
  } else {
    audio.pause();
    btnPlayPause.textContent = '▶';
  }
});

document.getElementById('progress-bar')!.addEventListener('click', (e) => {
  const audio = engine.getAudioElement();
  if (!audio || !audio.duration) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  audio.currentTime = ratio * audio.duration;
});

btnDemo.addEventListener('click', async () => {
  clearSourceActive();
  btnDemo.classList.add('active');
  await engine.startDemo();
  startVis();
});

function startVis() {
  welcome.classList.add('hidden');
  if (!running) {
    running = true;
    loop();
  }
}

// ===== Mode selector =====
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = (btn as HTMLElement).dataset.mode as VisualizerMode;
  });
});

// ===== Theme selector =====
document.querySelectorAll('.theme-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.theme-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentTheme = (pill as HTMLElement).dataset.theme as ColorTheme;
  });
});

// ===== Sensitivity =====
document.getElementById('sensitivity')!.addEventListener('input', (e) => {
  sensitivity = parseFloat((e.target as HTMLInputElement).value);
});

// ===== Fullscreen =====
document.getElementById('btn-fullscreen')!.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

// ===== Drag & Drop =====
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropZone.classList.add('visible');
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropZone.classList.remove('visible');
    dropZone.classList.remove('dragover');
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropZone.classList.remove('visible');
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith('audio/')) {
    await loadFile(file);
  }
});

// ===== Render loop =====
function loop() {
  if (!running) return;
  requestAnimationFrame(loop);

  const data = engine.getData();

  // Apply sensitivity
  const scaled = {
    ...data,
    bass: Math.min(1, data.bass * sensitivity),
    mid: Math.min(1, data.mid * sensitivity),
    treble: Math.min(1, data.treble * sensitivity),
    energy: Math.min(1, data.energy * sensitivity),
    peak: Math.min(1, data.peak * sensitivity),
  };

  time += 0.016;

  const theme = THEMES[currentTheme];
  const w = window.innerWidth;
  const h = window.innerHeight;

  visualizers[currentMode].draw(ctx, w, h, scaled, theme, time);
}

// ===== Helpers =====
function formatTime(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
