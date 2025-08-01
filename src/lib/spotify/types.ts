export interface SpotifyTrack {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string; width: number; height: number }>
  }
  preview_url: string | null
  external_urls: { spotify: string }
  duration_ms: number
}

export interface AudioFeatures {
  acousticness: number
  danceability: number
  energy: number
  instrumentalness: number
  liveness: number
  loudness: number
  speechiness: number
  valence: number
  tempo: number
  key: number
  mode: number
  time_signature: number
}

export interface SearchResponse {
  tracks: {
    items: SpotifyTrack[]
    total: number
  }
}