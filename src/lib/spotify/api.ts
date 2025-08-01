import type { SpotifyTrack, AudioFeatures, SearchResponse } from './types'

export class SpotifyAPI {
  private baseURL = '/api'

  async searchTracks(query: string, limit = 20): Promise<SpotifyTrack[]> {
    try {
      // Search for more tracks to filter for ones with previews
      const searchLimit = Math.min(50, limit * 3)
      const response = await fetch(
        `${this.baseURL}/spotify-search?q=${encodeURIComponent(query)}&limit=${searchLimit}`
      )
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`)
      }
      
      const data: SearchResponse = await response.json()
      const allTracks = data.tracks.items
      
      // Prioritize tracks with previews, but include others if needed
      const tracksWithPreviews = allTracks.filter(track => track.preview_url)
      const tracksWithoutPreviews = allTracks.filter(track => !track.preview_url)
      
      // Return tracks with previews first, then fill with others up to limit
      const result = [
        ...tracksWithPreviews.slice(0, limit),
        ...tracksWithoutPreviews.slice(0, Math.max(0, limit - tracksWithPreviews.length))
      ]
      
      return result.slice(0, limit)
    } catch (error) {
      console.error('Search error:', error)
      throw error
    }
  }

  async getAudioFeatures(trackId: string): Promise<AudioFeatures> {
    try {
      const response = await fetch(`${this.baseURL}/spotify-features?id=${trackId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get audio features: ${response.statusText}`)
      }
      
      return response.json()
    } catch (error) {
      console.error('Audio features error:', error)
      throw error
    }
  }

  async getTrack(trackId: string): Promise<SpotifyTrack> {
    try {
      const response = await fetch(`${this.baseURL}/spotify-search?id=${trackId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get track: ${response.statusText}`)
      }
      
      return response.json()
    } catch (error) {
      console.error('Get track error:', error)
      throw error
    }
  }
}