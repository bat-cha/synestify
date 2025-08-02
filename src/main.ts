import './style.css'
import { EnergyVisualizer, type AudioFeatures } from './lib/visualizer/EnergyVisualizer'
import { SpotifyAPI } from './lib/spotify/api'
import type { SpotifyTrack } from './lib/spotify/types'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Synestify</h1>
    <p>Interactive Spotify Music Visualizer</p>
    
    <div class="search-container">
      <div class="search-box">
        <input type="text" id="search-input" placeholder="Search for a song..." />
        <button id="search-btn">Search</button>
      </div>
      <div id="search-results" class="search-results"></div>
    </div>
    
    <div class="track-container">
      <div id="track-info" class="track-info"></div>
      <div id="audio-features" class="audio-features"></div>
      <div class="visualization-controls">
        <button id="visualize-btn" disabled>🎨 Visualize Track</button>
        <button id="auto-animate-btn">🔄 Auto Animation</button>
        <div class="speed-control">
          <label>Animation Speed:</label>
          <input type="range" id="speed-slider" min="0.1" max="3" step="0.1" value="1" />
          <span id="speed-value">1x</span>
        </div>
      </div>
    </div>
    
    <div class="visualizer-container">
      <canvas id="visualizer" width="400" height="400"></canvas>
    </div>
    
    <div class="controls">
      <button id="demo-btn">Demo Visualization</button>
      <div class="demo-tracks">
        <p class="demo-info">Try these sample searches (more likely to have previews):</p>
        <div class="demo-track-buttons">
          <button class="demo-search-btn" data-query="dua lipa levitating">Levitating - Dua Lipa</button>
          <button class="demo-search-btn" data-query="olivia rodrigo good 4 u">good 4 u - Olivia Rodrigo</button>
          <button class="demo-search-btn" data-query="bad bunny titi me pregunto">Titi Me Preguntó - Bad Bunny</button>
        </div>
      </div>
    </div>
  </div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#visualizer')!
const visualizer = new EnergyVisualizer(canvas)
const spotifyAPI = new SpotifyAPI()

let currentFeatures: AudioFeatures | null = null
let animationSpeed = 1
let autoAnimateInterval: number | null = null

const searchInput = document.querySelector<HTMLInputElement>('#search-input')!
const searchBtn = document.querySelector<HTMLButtonElement>('#search-btn')!
const searchResults = document.querySelector<HTMLDivElement>('#search-results')!
const trackInfo = document.querySelector<HTMLDivElement>('#track-info')!
const audioFeatures = document.querySelector<HTMLDivElement>('#audio-features')!
const visualizeBtn = document.querySelector<HTMLButtonElement>('#visualize-btn')!
const autoAnimateBtn = document.querySelector<HTMLButtonElement>('#auto-animate-btn')!
const speedSlider = document.querySelector<HTMLInputElement>('#speed-slider')!
const speedValue = document.querySelector<HTMLSpanElement>('#speed-value')!

async function searchTracks(query: string) {
  if (!query.trim()) return
  
  try {
    searchBtn.textContent = 'Searching...'
    searchBtn.disabled = true
    
    const tracks = await spotifyAPI.searchTracks(query, 10)
    console.log('Tracks with previews:', tracks.filter(t => t.preview_url).length, 'out of', tracks.length)
    console.log('Sample track preview_url:', tracks[0]?.preview_url)
    console.log('All preview URLs:', tracks.map(t => ({ name: t.name, preview_url: t.preview_url })))
    displaySearchResults(tracks)
  } catch (error) {
    console.error('Search failed:', error)
    searchResults.innerHTML = '<p class="error">Search failed. Please try again.</p>'
  } finally {
    searchBtn.textContent = 'Search'
    searchBtn.disabled = false
  }
}

function displaySearchResults(tracks: SpotifyTrack[]) {
  if (tracks.length === 0) {
    searchResults.innerHTML = '<p>No tracks found.</p>'
    return
  }

  searchResults.innerHTML = tracks.map(track => {
    const imageUrl = track.album.images && track.album.images.length > 0 
      ? track.album.images[track.album.images.length - 1]?.url || ''
      : ''
    
    return `
      <div class="track-result" data-track-id="${track.id}">
        ${imageUrl ? `<img src="${imageUrl}" alt="${track.album.name}" class="track-image" />` : '<div class="track-image-placeholder"></div>'}
        <div class="track-details">
          <div class="track-name">${escapeHtml(track.name)}</div>
          <div class="track-artist">${escapeHtml(track.artists.map(a => a.name).join(', '))}</div>
          <div class="track-album">${escapeHtml(track.album.name)}</div>
          ${!track.preview_url ? '<span class="no-preview">⚠️ No preview available</span>' : '<span class="preview-available">🎵 Preview available</span>'}
        </div>
      </div>
    `
  }).join('')

  searchResults.querySelectorAll('.track-result').forEach((result, index) => {
    result.addEventListener('click', () => selectTrack(tracks[index]))
  })
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

async function selectTrack(track: SpotifyTrack) {

  const currentImageUrl = track.album.images && track.album.images.length > 0 
    ? track.album.images[0]?.url || track.album.images[track.album.images.length - 1]?.url || ''
    : ''

  trackInfo.innerHTML = `
    ${currentImageUrl ? `<img src="${currentImageUrl}" alt="${track.album.name}" class="current-track-image" />` : '<div class="current-track-image-placeholder">🎵</div>'}
    <div class="current-track-details">
      <div class="current-track-name">${escapeHtml(track.name)}</div>
      <div class="current-track-artist">${escapeHtml(track.artists.map(a => a.name).join(', '))}</div>
      <div class="current-track-album">${escapeHtml(track.album.name)}</div>
      <div class="track-duration">${formatDuration(track.duration_ms)}</div>
    </div>
  `

  visualizeBtn.disabled = false
  audioFeatures.innerHTML = '<div class="loading">Loading audio features...</div>'

  try {
    const features = await spotifyAPI.getAudioFeatures(track.id)
    currentFeatures = features
    displayAudioFeatures(features)
  } catch (error) {
    console.error('Failed to get audio features:', error)
    audioFeatures.innerHTML = '<div class="error">Failed to load audio features</div>'
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function displayAudioFeatures(features: AudioFeatures) {
  const featureLabels = {
    energy: 'Energy',
    valence: 'Positivity',
    danceability: 'Danceability',
    acousticness: 'Acoustic',
    instrumentalness: 'Instrumental',
    liveness: 'Live Performance',
    speechiness: 'Speechiness'
  }

  const featureColors = {
    energy: '#ff6b6b',
    valence: '#4ecdc4',
    danceability: '#45b7d1',
    acousticness: '#96ceb4',
    instrumentalness: '#feca57',
    liveness: '#ff9ff3',
    speechiness: '#54a0ff'
  }

  audioFeatures.innerHTML = `
    <h3>Musical DNA</h3>
    <div class="features-grid">
      ${Object.entries(featureLabels).map(([key, label]) => {
        const value = features[key as keyof AudioFeatures] as number
        const percentage = Math.round(value * 100)
        const color = featureColors[key as keyof typeof featureColors]
        
        return `
          <div class="feature-item">
            <div class="feature-label">${label}</div>
            <div class="feature-bar">
              <div class="feature-fill" style="width: ${percentage}%; background-color: ${color}"></div>
            </div>
            <div class="feature-value">${percentage}%</div>
          </div>
        `
      }).join('')}
      <div class="feature-item tempo">
        <div class="feature-label">Tempo</div>
        <div class="feature-value large">${Math.round(features.tempo)} BPM</div>
      </div>
      <div class="feature-item key">
        <div class="feature-label">Key</div>
        <div class="feature-value large">${getKeyName(features.key, features.mode)}</div>
      </div>
    </div>
  `
}

function getKeyName(key: number, mode: number): string {
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const keyName = keys[key] || '?'
  const modeName = mode === 1 ? 'Major' : 'Minor'
  return `${keyName} ${modeName}`
}

searchBtn.addEventListener('click', () => {
  searchTracks(searchInput.value)
})

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchTracks(searchInput.value)
  }
})

visualizeBtn.addEventListener('click', () => {
  if (currentFeatures) {
    visualizer.render(currentFeatures)
    visualizeBtn.textContent = '🎨 Visualizing...'
    setTimeout(() => {
      visualizeBtn.textContent = '🎨 Visualize Track'
    }, 2000)
  }
})

autoAnimateBtn.addEventListener('click', () => {
  if (autoAnimateInterval) {
    clearInterval(autoAnimateInterval)
    autoAnimateInterval = null
    autoAnimateBtn.textContent = '🔄 Auto Animation'
    autoAnimateBtn.classList.remove('active')
  } else {
    startAutoAnimation()
    autoAnimateBtn.textContent = '⏸️ Stop Animation'
    autoAnimateBtn.classList.add('active')
  }
})

speedSlider.addEventListener('input', () => {
  animationSpeed = parseFloat(speedSlider.value)
  speedValue.textContent = `${animationSpeed}x`
  
  // Update the visualizer's animation speed
  if (visualizer.setAnimationSpeed) {
    visualizer.setAnimationSpeed(animationSpeed)
  }
})

function startAutoAnimation() {
  if (!currentFeatures) return
  
  autoAnimateInterval = setInterval(() => {
    if (currentFeatures) {
      // Create variations of the current features for dynamic animation
      const animatedFeatures = createAnimatedFeatures(currentFeatures)
      visualizer.render(animatedFeatures)
    }
  }, 100 / animationSpeed) as unknown as number
}

function createAnimatedFeatures(baseFeatures: AudioFeatures): AudioFeatures {
  const time = Date.now() / 1000
  const variation = 0.1 // 10% variation
  
  // Helper function to ensure values are finite and clamped
  const clamp = (value: number, min: number, max: number): number => {
    if (!isFinite(value)) return min
    return Math.max(min, Math.min(max, value))
  }
  
  return {
    ...baseFeatures,
    energy: clamp(baseFeatures.energy + Math.sin(time * 2) * variation, 0, 1),
    valence: clamp(baseFeatures.valence + Math.cos(time * 1.5) * variation, 0, 1),
    danceability: clamp(baseFeatures.danceability + Math.sin(time * 3) * variation * 0.5, 0, 1),
    tempo: clamp(baseFeatures.tempo + Math.sin(time * 0.5) * 10, 60, 200),
    acousticness: clamp(baseFeatures.acousticness || 0, 0, 1),
    instrumentalness: clamp(baseFeatures.instrumentalness || 0, 0, 1),
    liveness: clamp(baseFeatures.liveness || 0, 0, 1),
    speechiness: clamp(baseFeatures.speechiness || 0, 0, 1),
    loudness: clamp(baseFeatures.loudness || -10, -60, 0),
    key: baseFeatures.key || 0,
    mode: baseFeatures.mode || 1,
    time_signature: baseFeatures.time_signature || 4
  }
}

const demoFeatures: AudioFeatures[] = [
  {
    acousticness: 0.2,
    danceability: 0.8,
    energy: 0.9,
    instrumentalness: 0.1,
    liveness: 0.3,
    loudness: -5,
    speechiness: 0.1,
    valence: 0.7,
    tempo: 128,
    key: 4,
    mode: 1,
    time_signature: 4
  },
  {
    acousticness: 0.8,
    danceability: 0.3,
    energy: 0.2,
    instrumentalness: 0.9,
    liveness: 0.1,
    loudness: -15,
    speechiness: 0.05,
    valence: 0.3,
    tempo: 72,
    key: 7,
    mode: 0,
    time_signature: 4
  },
  {
    acousticness: 0.1,
    danceability: 0.9,
    energy: 0.95,
    instrumentalness: 0.0,
    liveness: 0.8,
    loudness: -3,
    speechiness: 0.2,
    valence: 0.9,
    tempo: 140,
    key: 2,
    mode: 1,
    time_signature: 4
  }
]

let currentDemo = 0

document.querySelector<HTMLButtonElement>('#demo-btn')!.addEventListener('click', () => {
  visualizer.render(demoFeatures[currentDemo])
  currentDemo = (currentDemo + 1) % demoFeatures.length
  
  const demoTypes = ['Electronic Dance', 'Acoustic Ballad', 'High Energy Rock']
  const btn = document.querySelector<HTMLButtonElement>('#demo-btn')!
  btn.textContent = `Demo: ${demoTypes[currentDemo]} →`
})

// Add event listeners for demo search buttons
document.querySelectorAll('.demo-search-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const query = btn.getAttribute('data-query')!
    searchInput.value = query
    searchTracks(query)
  })
})

window.addEventListener('resize', () => {
  visualizer.resize()
})
