export const config = { runtime: 'edge' }

import { getSpotifyToken } from './spotify-token'

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url)
  const trackId = searchParams.get('id')

  if (!trackId) {
    return new Response('Missing track ID', { status: 400 })
  }

  try {
    // Get access token using shared token service
    const access_token = await getSpotifyToken()

    // Get audio features
    const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })

    if (!response.ok) {
      console.error('Audio features request failed:', response.status, response.statusText)
      return new Response('Failed to get audio features', { status: 500 })
    }

    const features = await response.json()

    return new Response(JSON.stringify(features), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600' // 1 hour cache (features never change)
      }
    })
  } catch (error) {
    console.error('Spotify features error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}