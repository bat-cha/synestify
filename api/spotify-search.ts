export const config = { runtime: 'edge' }

import { getSpotifyToken } from './spotify-token'

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const limit = searchParams.get('limit') || '20'
  const trackId = searchParams.get('id')

  if (!query && !trackId) {
    return new Response('Missing query or track ID', { status: 400 })
  }

  try {
    // Get access token using shared token service
    const access_token = await getSpotifyToken()

    // Search tracks or get specific track
    const endpoint = trackId 
      ? `https://api.spotify.com/v1/tracks/${trackId}`
      : `https://api.spotify.com/v1/search?q=${encodeURIComponent(query!)}&type=track&limit=${limit}`

    const spotifyResponse = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })

    const data = await spotifyResponse.json()

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300' // 5 minute cache
      }
    })
  } catch (error) {
    console.error('Spotify search error:', error)
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