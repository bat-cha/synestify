import './style.css';
import { AudioEngine, type AudioData } from './lib/audio/AudioEngine';
import { AudiusClient, type AudiusTrack } from './lib/audio/AudiusClient';
import { THEMES, type VisualizerMode, type ColorTheme, type Visualizer } from './lib/visualizer/types';
// Existing 2D visualizers
import { WaveformOcean } from './lib/visualizer/WaveformOcean';
import { FrequencySpectrum } from './lib/visualizer/FrequencySpectrum';
import { ParticleGalaxy } from './lib/visualizer/ParticleGalaxy';
import { SynesthesiaMode } from './lib/visualizer/SynesthesiaMode';
import { GeometricHarmonics } from './lib/visualizer/GeometricHarmonics';
// 3D visualizers
import { SceneManager, type QualityLevel } from './lib/visualizer3d/SceneManager';
import { Nebula } from './lib/visualizer3d/modes/Nebula';
import { Terrain } from './lib/visualizer3d/modes/Terrain';
import { Crystalline } from './lib/visualizer3d/modes/Crystalline';
import { NeuralNetwork } from './lib/visualizer3d/modes/NeuralNetwork';
import { WaveformTunnel } from './lib/visualizer3d/modes/WaveformTunnel';

// ===== Types =====
type VisualizerMode3D = 'nebula' | 'terrain' | 'crystalline' | 'neural' | 'tunnel';
type AppMode = VisualizerMode3D | 'classic';

interface ModeInfo {
  id: AppMode;
  icon: string;
  label: string;
  key: string;
}

const MODES: ModeInfo[] = [
  { id: 'nebula', icon: '\u2728', label: 'Nebula', key: '1' },
  { id: 'terrain', icon: '\u26f0\ufe0f', label: 'Terrain', key: '2' },
  { id: 'crystalline', icon: '\ud83d\udc8e', label: 'Crystal', key: '3' },
  { id: 'neural', icon: '\ud83e\udde0', label: 'Neural', key: '4' },
  { id: 'tunnel', icon: '\ud83c\udf00', label: 'Tunnel', key: '5' },
  { id: 'classic', icon: '\ud83c\udfa8', label: 'Classic', key: '6' },
];

// ===== State =====
let currentMode: AppMode = 'nebula';
let classicSubMode: VisualizerMode = 'galaxy';
let currentTheme: ColorTheme = 'neon';
let sensitivity = 1;
let quality: QualityLevel = 'high';
let settingsOpen = false;
let recording = false;
let muted = false;
let volume = 0.8;
let time = 0;
let running = false;
let uiVisible = true;

// ===== Core Instances =====
const engine = new AudioEngine();
const audius = new AudiusClient();
const visualizers: Record<VisualizerMode, Visualizer> = {
  ocean: new WaveformOcean(),
  spectrum: new FrequencySpectrum(),
  galaxy: new ParticleGalaxy(),
  synesthesia: new SynesthesiaMode(),
  geometric: new GeometricHarmonics(),
};

// ===== Recording =====
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

// Helper to avoid TS narrowing issues in template literals
const activeIf = (a: string, b: string) => a === b ? ' active' : '';

// ===== DOM Setup =====
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="renderer-container"></div>
  <canvas id="classic-canvas"></canvas>

  <div id="ui-overlay">
    <div id="top-bar">
      <h1 class="logo">SYNESTIFY</h1>
      <div id="now-playing">
        <img id="now-playing-art" alt="" />
        <div class="now-playing-info">
          <div id="now-playing-title"></div>
          <div id="now-playing-artist"></div>
        </div>
      </div>
      <div id="top-controls">
        <button class="btn btn-icon" id="btn-screenshot" title="Screenshot (S)">&#x1f4f7;</button>
        <button class="btn btn-icon" id="btn-record" title="Record (R)">&#x23fa;</button>
        <button class="btn btn-icon" id="btn-fullscreen" title="Fullscreen (F)">&#x26f6;</button>
        <button class="btn btn-icon" id="btn-settings" title="Settings">&#x2699;</button>
      </div>
    </div>

    <div id="bottom-area">
      <div id="mode-selector">
        ${MODES.map(m => `
          <div class="mode-card${m.id === currentMode ? ' active' : ''}" data-mode="${m.id}">
            <span class="mode-card-icon">${m.icon}</span>
            <span class="mode-card-label">${m.label}</span>
            <span class="mode-card-key">${m.key}</span>
          </div>
        `).join('')}
      </div>

      <div id="bottom-bar">
        <div class="source-row">
          <button class="btn" id="btn-mic">\ud83c\udfa4 Mic</button>
          <button class="btn" id="btn-file">\ud83d\udcc1 File</button>
          <button class="btn" id="btn-audius">\ud83c\udfb5 Audius</button>
          <button class="btn" id="btn-demo">\ud83d\udd0a Demo</button>
          <input type="file" id="file-input" accept="audio/*" />
        </div>

        <div class="playback-row" id="playback-row">
          <button class="btn btn-icon" id="btn-play-pause">&#x23f8;</button>
          <span class="playback-time" id="time-current">0:00</span>
          <div class="progress-bar" id="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <span class="playback-time" id="time-total">0:00</span>
        </div>

        <div class="volume-group">
          <span class="volume-icon" id="volume-icon">\ud83d\udd0a</span>
          <input type="range" id="volume-slider" min="0" max="1" step="0.01" value="0.8" />
        </div>

        <div id="audius-search">
          <input type="text" id="audius-search-input" placeholder="Search Audius..." />
          <div id="audius-results"></div>
        </div>
      </div>
    </div>
  </div>

  <div id="settings-panel">
    <div class="settings-header">
      <span class="settings-title">Settings</span>
      <button class="settings-close" id="settings-close">&times;</button>
    </div>

    <div class="settings-group">
      <span class="settings-label">Quality</span>
      <div class="quality-buttons">
        <button class="quality-btn${activeIf(quality, 'low')}" data-quality="low">Low</button>
        <button class="quality-btn${activeIf(quality, 'medium')}" data-quality="medium">Medium</button>
        <button class="quality-btn${activeIf(quality, 'high')}" data-quality="high">High</button>
      </div>
    </div>

    <div class="settings-group">
      <span class="settings-label">Theme</span>
      <div class="theme-pills">
        <div class="theme-pill neon${activeIf(currentTheme, 'neon')}" data-theme="neon"></div>
        <div class="theme-pill sunset${activeIf(currentTheme, 'sunset')}" data-theme="sunset"></div>
        <div class="theme-pill ocean${activeIf(currentTheme, 'ocean')}" data-theme="ocean"></div>
        <div class="theme-pill monochrome${activeIf(currentTheme, 'monochrome')}" data-theme="monochrome"></div>
      </div>
    </div>

    <div class="settings-group">
      <span class="settings-label">Sensitivity</span>
      <div class="slider-row">
        <input type="range" id="sensitivity-slider" min="0.2" max="3" step="0.1" value="${sensitivity}" />
        <span class="slider-value" id="sensitivity-value">${sensitivity.toFixed(1)}</span>
      </div>
    </div>

    <div class="settings-group">
      <span class="settings-label">Volume</span>
      <div class="slider-row">
        <input type="range" id="settings-volume" min="0" max="1" step="0.01" value="${volume}" />
        <span class="slider-value" id="settings-volume-value">${Math.round(volume * 100)}%</span>
      </div>
    </div>

    <div class="settings-group">
      <span class="settings-label">Classic Mode</span>
      <div class="quality-buttons">
        <button class="quality-btn${activeIf(classicSubMode, 'ocean')}" data-classic="ocean">Ocean</button>
        <button class="quality-btn${activeIf(classicSubMode, 'spectrum')}" data-classic="spectrum">Spectrum</button>
        <button class="quality-btn${activeIf(classicSubMode, 'galaxy')}" data-classic="galaxy">Galaxy</button>
        <button class="quality-btn${activeIf(classicSubMode, 'synesthesia')}" data-classic="synesthesia">Synth</button>
        <button class="quality-btn${activeIf(classicSubMode, 'geometric')}" data-classic="geometric">Geo</button>
      </div>
    </div>
  </div>

  <div id="welcome-screen">
    <h1 class="welcome-logo">SYNESTIFY</h1>
    <p class="welcome-tagline">Experience music in a new dimension</p>
    <div class="welcome-buttons">
      <button class="welcome-btn" id="welcome-mic">
        <span class="welcome-btn-icon">\ud83c\udfa4</span>
        <span class="welcome-btn-text">Microphone</span>
      </button>
      <button class="welcome-btn" id="welcome-file">
        <span class="welcome-btn-icon">\ud83d\udcc1</span>
        <span class="welcome-btn-text">Upload File</span>
      </button>
      <button class="welcome-btn" id="welcome-audius">
        <span class="welcome-btn-icon">\ud83c\udfb5</span>
        <span class="welcome-btn-text">Browse Audius</span>
      </button>
    </div>
    <button class="welcome-demo-link" id="welcome-demo">or try the demo</button>
  </div>

  <div id="drop-zone">
    <div class="drop-zone-inner">
      <div class="drop-zone-icon">\ud83c\udfb6</div>
      <h2 class="drop-zone-title">Drop audio file here</h2>
      <p class="drop-zone-subtitle">MP3, WAV, OGG, FLAC</p>
    </div>
  </div>

  <div id="flash-overlay"></div>
  <div id="bpm-display"></div>
`;

// ===== Element References =====
const rendererContainer = document.getElementById('renderer-container')!;
const classicCanvas = document.getElementById('classic-canvas') as HTMLCanvasElement;
const classicCtx = classicCanvas.getContext('2d')!;
const uiOverlay = document.getElementById('ui-overlay')!;
const welcomeScreen = document.getElementById('welcome-screen')!;
const dropZone = document.getElementById('drop-zone')!;
const flashOverlay = document.getElementById('flash-overlay')!;
const settingsPanel = document.getElementById('settings-panel')!;
const playbackRow = document.getElementById('playback-row')!;
const progressFill = document.getElementById('progress-fill')!;
const timeCurrent = document.getElementById('time-current')!;
const timeTotal = document.getElementById('time-total')!;
const btnPlayPause = document.getElementById('btn-play-pause')!;
const nowPlaying = document.getElementById('now-playing')!;
const nowPlayingTitle = document.getElementById('now-playing-title')!;
const nowPlayingArtist = document.getElementById('now-playing-artist')!;
const nowPlayingArt = document.getElementById('now-playing-art') as HTMLImageElement;
const audiusSearch = document.getElementById('audius-search')!;
const audiusSearchInput = document.getElementById('audius-search-input') as HTMLInputElement;
const audiusResults = document.getElementById('audius-results')!;
const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
const volumeIcon = document.getElementById('volume-icon')!;
const bpmDisplay = document.getElementById('bpm-display')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const btnMic = document.getElementById('btn-mic')!;
const btnFile = document.getElementById('btn-file')!;
const btnAudius = document.getElementById('btn-audius')!;
const btnDemo = document.getElementById('btn-demo')!;

// ===== 3D Scene Manager =====
let sceneManager: SceneManager | null = null;
try {
  sceneManager = new SceneManager(rendererContainer, quality);
  sceneManager.setMode(new Nebula());
} catch (e) {
  console.warn('3D visualizer not available yet:', e);
}

// ===== Classic Canvas Sizing =====
function resizeClassicCanvas() {
  const dpr = window.devicePixelRatio || 1;
  classicCanvas.width = window.innerWidth * dpr;
  classicCanvas.height = window.innerHeight * dpr;
  classicCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeClassicCanvas();

window.addEventListener('resize', () => {
  resizeClassicCanvas();
  sceneManager?.resize();
});

// ===== Helper Functions =====
function formatTime(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Source Management =====
function clearSourceActive() {
  btnMic.classList.remove('active');
  btnFile.classList.remove('active');
  btnAudius.classList.remove('active');
  btnDemo.classList.remove('active');
  playbackRow.classList.remove('visible');
  audiusSearch.classList.remove('visible');
}

function startVis() {
  welcomeScreen.classList.add('hidden');
  if (!running) {
    running = true;
    animate();
  }
}

function setupAudioEvents(audio: HTMLAudioElement) {
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
    btnPlayPause.innerHTML = '&#x25b6;';
  });
  btnPlayPause.innerHTML = '&#x23f8;';
}

// Mic
async function startMic() {
  clearSourceActive();
  btnMic.classList.add('active');
  try {
    await engine.startMic();
    startVis();
  } catch (e) {
    console.error('Mic access denied:', e);
    btnMic.classList.remove('active');
  }
}

// File
async function loadFile(file: File) {
  clearSourceActive();
  btnFile.classList.add('active');
  const audio = await engine.startFile(file);
  setupAudioEvents(audio);
  startVis();
}

// Demo
async function startDemo() {
  clearSourceActive();
  btnDemo.classList.add('active');
  await engine.startDemo();
  startVis();
}

// Audius
async function playAudiusTrack(track: AudiusTrack) {
  clearSourceActive();
  btnAudius.classList.add('active');
  audiusSearch.classList.add('visible');
  const audio = await engine.startAudius(track);
  setupAudioEvents(audio);
  startVis();
  audiusResults.classList.remove('visible');
  audiusSearchInput.value = '';
}

// ===== Source Button Handlers =====
btnMic.addEventListener('click', startMic);

btnFile.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  await loadFile(file);
});

btnAudius.addEventListener('click', () => {
  clearSourceActive();
  btnAudius.classList.add('active');
  audiusSearch.classList.add('visible');
  audiusSearchInput.focus();
});

btnDemo.addEventListener('click', startDemo);

// ===== Welcome Screen Handlers =====
document.getElementById('welcome-mic')!.addEventListener('click', startMic);
document.getElementById('welcome-file')!.addEventListener('click', () => fileInput.click());
document.getElementById('welcome-audius')!.addEventListener('click', () => {
  welcomeScreen.classList.add('hidden');
  clearSourceActive();
  btnAudius.classList.add('active');
  audiusSearch.classList.add('visible');
  audiusSearchInput.focus();
});
document.getElementById('welcome-demo')!.addEventListener('click', startDemo);

// ===== Playback Controls =====
btnPlayPause.addEventListener('click', togglePlayPause);

function togglePlayPause() {
  const audio = engine.getAudioElement();
  if (!audio) return;
  if (audio.paused) {
    audio.play();
    btnPlayPause.innerHTML = '&#x23f8;';
  } else {
    audio.pause();
    btnPlayPause.innerHTML = '&#x25b6;';
  }
}

document.getElementById('progress-bar')!.addEventListener('click', (e) => {
  const audio = engine.getAudioElement();
  if (!audio || !audio.duration) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  audio.currentTime = ratio * audio.duration;
});

// ===== Volume =====
volumeSlider.addEventListener('input', () => {
  volume = parseFloat(volumeSlider.value);
  muted = false;
  engine.setGain(volume);
  updateVolumeIcon();
  // Sync settings panel volume slider
  const sv = document.getElementById('settings-volume') as HTMLInputElement | null;
  if (sv) {
    sv.value = String(volume);
    const svv = document.getElementById('settings-volume-value');
    if (svv) svv.textContent = Math.round(volume * 100) + '%';
  }
});

volumeIcon.addEventListener('click', toggleMute);

function toggleMute() {
  muted = !muted;
  engine.setGain(muted ? 0 : volume);
  updateVolumeIcon();
}

function updateVolumeIcon() {
  if (muted || volume === 0) {
    volumeIcon.textContent = '\ud83d\udd07';
  } else if (volume < 0.5) {
    volumeIcon.textContent = '\ud83d\udd09';
  } else {
    volumeIcon.textContent = '\ud83d\udd0a';
  }
}

function adjustVolume(delta: number) {
  volume = Math.max(0, Math.min(1, volume + delta));
  muted = false;
  engine.setGain(volume);
  volumeSlider.value = String(volume);
  updateVolumeIcon();
}

// ===== Mode Switching =====
function setMode(mode: AppMode) {
  currentMode = mode;

  // Update mode cards
  document.querySelectorAll('.mode-card').forEach(card => {
    card.classList.toggle('active', (card as HTMLElement).dataset.mode === mode);
  });

  // Toggle classic canvas vs 3D renderer
  if (mode === 'classic') {
    classicCanvas.classList.add('active');
    rendererContainer.style.display = 'none';
  } else {
    classicCanvas.classList.remove('active');
    rendererContainer.style.display = '';
    // Set 3D mode
    if (sceneManager) {
      const modeInstances: Record<VisualizerMode3D, () => InstanceType<typeof Nebula | typeof Terrain | typeof Crystalline | typeof NeuralNetwork | typeof WaveformTunnel>> = {
        nebula: () => new Nebula(),
        terrain: () => new Terrain(),
        crystalline: () => new Crystalline(),
        neural: () => new NeuralNetwork(),
        tunnel: () => new WaveformTunnel(),
      };
      const create = modeInstances[mode as VisualizerMode3D];
      if (create) {
        sceneManager.setMode(create());
      }
    }
  }
}

document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    setMode((card as HTMLElement).dataset.mode as AppMode);
  });
});

// ===== Settings Panel =====
document.getElementById('btn-settings')!.addEventListener('click', () => {
  settingsOpen = !settingsOpen;
  settingsPanel.classList.toggle('open', settingsOpen);
});

document.getElementById('settings-close')!.addEventListener('click', () => {
  settingsOpen = false;
  settingsPanel.classList.remove('open');
});

// Quality
document.querySelectorAll('.quality-btn[data-quality]').forEach(btn => {
  btn.addEventListener('click', () => {
    quality = (btn as HTMLElement).dataset.quality as QualityLevel;
    document.querySelectorAll('.quality-btn[data-quality]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sceneManager?.setQuality(quality);
  });
});

// Theme
document.querySelectorAll('.theme-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    currentTheme = (pill as HTMLElement).dataset.theme as ColorTheme;
    document.querySelectorAll('.theme-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    updateCSSTheme();
  });
});

function updateCSSTheme() {
  const theme = THEMES[currentTheme];
  document.documentElement.style.setProperty('--primary', theme.primary);
  document.documentElement.style.setProperty('--secondary', theme.secondary);
  document.documentElement.style.setProperty('--accent', theme.accent);
  document.documentElement.style.setProperty('--bg', theme.bg);
}

// Sensitivity
document.getElementById('sensitivity-slider')!.addEventListener('input', (e) => {
  sensitivity = parseFloat((e.target as HTMLInputElement).value);
  document.getElementById('sensitivity-value')!.textContent = sensitivity.toFixed(1);
});

function adjustSensitivity(delta: number) {
  sensitivity = Math.max(0.2, Math.min(3, sensitivity + delta));
  const slider = document.getElementById('sensitivity-slider') as HTMLInputElement;
  slider.value = String(sensitivity);
  document.getElementById('sensitivity-value')!.textContent = sensitivity.toFixed(1);
}

// Settings volume
document.getElementById('settings-volume')!.addEventListener('input', (e) => {
  volume = parseFloat((e.target as HTMLInputElement).value);
  muted = false;
  engine.setGain(volume);
  volumeSlider.value = String(volume);
  updateVolumeIcon();
  document.getElementById('settings-volume-value')!.textContent = Math.round(volume * 100) + '%';
});

// Classic sub-mode
document.querySelectorAll('.quality-btn[data-classic]').forEach(btn => {
  btn.addEventListener('click', () => {
    classicSubMode = (btn as HTMLElement).dataset.classic as VisualizerMode;
    document.querySelectorAll('.quality-btn[data-classic]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ===== Fullscreen =====
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

document.getElementById('btn-fullscreen')!.addEventListener('click', toggleFullscreen);

// ===== Screenshot =====
function takeScreenshot() {
  const canvas = currentMode === 'classic' ? classicCanvas : sceneManager?.getCanvas();
  if (!canvas) return;

  const link = document.createElement('a');
  link.download = `synestify-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();

  // Flash effect
  flashOverlay.classList.add('flash');
  setTimeout(() => flashOverlay.classList.remove('flash'), 150);
}

document.getElementById('btn-screenshot')!.addEventListener('click', takeScreenshot);

// ===== Video Recording =====
function toggleRecording() {
  const btnRecord = document.getElementById('btn-record')!;

  if (recording) {
    mediaRecorder?.stop();
    recording = false;
    btnRecord.classList.remove('recording');
    btnRecord.innerHTML = '&#x23fa;';
  } else {
    const canvas = currentMode === 'classic' ? classicCanvas : sceneManager?.getCanvas();
    if (!canvas) return;

    const stream = canvas.captureStream(60);
    // Try vp9 first, fall back to vp8
    const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
      ? 'video/webm; codecs=vp9'
      : 'video/webm';
    mediaRecorder = new MediaRecorder(stream, { mimeType });
    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `synestify-${Date.now()}.webm`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorder.start();
    recording = true;
    btnRecord.classList.add('recording');
    btnRecord.innerHTML = '&#x23f9;';
  }
}

document.getElementById('btn-record')!.addEventListener('click', toggleRecording);

// ===== Audius Search =====
let searchTimeout: number;

audiusSearchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = window.setTimeout(async () => {
    const query = audiusSearchInput.value.trim();
    if (!query) {
      audiusResults.classList.remove('visible');
      return;
    }
    try {
      const results = await audius.search(query, 10);
      showSearchResults(results);
    } catch (e) {
      console.error('Audius search failed:', e);
    }
  }, 300);
});

function showSearchResults(tracks: AudiusTrack[]) {
  if (tracks.length === 0) {
    audiusResults.innerHTML = '<div class="search-result"><div class="result-info"><div class="result-title">No results found</div></div></div>';
    audiusResults.classList.add('visible');
    return;
  }

  audiusResults.innerHTML = tracks.map(t => `
    <div class="search-result" data-track-id="${escapeHtml(t.id)}">
      ${t.artworkUrl ? `<img src="${escapeHtml(t.artworkUrl)}" class="result-art" alt="" />` : '<div class="result-art-placeholder"></div>'}
      <div class="result-info">
        <div class="result-title">${escapeHtml(t.title)}</div>
        <div class="result-artist">${escapeHtml(t.artist)}</div>
      </div>
      <div class="result-duration">${formatTime(t.duration)}</div>
    </div>
  `).join('');

  // Attach click handlers
  audiusResults.querySelectorAll('.search-result[data-track-id]').forEach(el => {
    el.addEventListener('click', () => {
      const trackId = (el as HTMLElement).dataset.trackId!;
      const track = tracks.find(t => t.id === trackId);
      if (track) playAudiusTrack(track);
    });
  });

  audiusResults.classList.add('visible');
}

// Close search results when clicking outside
document.addEventListener('click', (e) => {
  if (!audiusSearch.contains(e.target as Node)) {
    audiusResults.classList.remove('visible');
  }
});

// ===== Now Playing =====
function updateNowPlaying() {
  const track = engine.getTrackInfo();
  if (!track) {
    nowPlaying.classList.remove('visible');
    return;
  }
  nowPlaying.classList.add('visible');
  nowPlayingTitle.textContent = track.title;
  nowPlayingArtist.textContent = track.artist;
  if (track.artworkUrl) {
    nowPlayingArt.src = track.artworkUrl;
    nowPlayingArt.classList.add('visible');
  } else {
    nowPlayingArt.classList.remove('visible');
  }
}

// ===== BPM Display =====
function updateBPMDisplay(data: AudioData) {
  if (data.bpm > 0) {
    bpmDisplay.textContent = `${data.bpm} BPM`;
  } else {
    bpmDisplay.textContent = '';
  }
}

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

// ===== UI Visibility =====
function toggleUI() {
  uiVisible = !uiVisible;
  uiOverlay.classList.toggle('hidden', !uiVisible);
}

// ===== Keyboard Shortcuts =====
document.addEventListener('keydown', (e) => {
  // Don't capture when typing in input fields
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      togglePlayPause();
      break;
    case '1': setMode('nebula'); break;
    case '2': setMode('terrain'); break;
    case '3': setMode('crystalline'); break;
    case '4': setMode('neural'); break;
    case '5': setMode('tunnel'); break;
    case '6': setMode('classic'); break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 'm': case 'M': toggleMute(); break;
    case 's': case 'S': takeScreenshot(); break;
    case 'r': case 'R': toggleRecording(); break;
    case 'h': case 'H': toggleUI(); break;
    case '+': case '=': adjustVolume(0.1); break;
    case '-': adjustVolume(-0.1); break;
    case '[': adjustSensitivity(-0.2); break;
    case ']': adjustSensitivity(0.2); break;
  }
});

// ===== Animation Loop =====
function animate() {
  if (!running) return;
  requestAnimationFrame(animate);

  const data = engine.getData();

  // Apply sensitivity
  const scaled: AudioData = {
    ...data,
    bass: Math.min(1, data.bass * sensitivity),
    mid: Math.min(1, data.mid * sensitivity),
    treble: Math.min(1, data.treble * sensitivity),
    energy: Math.min(1, data.energy * sensitivity),
    peak: Math.min(1, data.peak * sensitivity),
    subBass: Math.min(1, data.subBass * sensitivity),
    upperMid: Math.min(1, data.upperMid * sensitivity),
    presence: Math.min(1, data.presence * sensitivity),
    spectralFlux: Math.min(1, data.spectralFlux * sensitivity),
    beatIntensity: Math.min(1, data.beatIntensity * sensitivity),
  };

  time += 0.016;

  if (currentMode === 'classic') {
    // Draw on 2D canvas
    const theme = THEMES[currentTheme];
    const w = window.innerWidth;
    const h = window.innerHeight;
    visualizers[classicSubMode].draw(classicCtx, w, h, scaled, theme, time);
  } else {
    // Update 3D scene
    sceneManager?.update(scaled, time);
  }

  updateNowPlaying();
  updateBPMDisplay(data);
}

// ===== Initialize Theme =====
updateCSSTheme();
