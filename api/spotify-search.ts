export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const limit = searchParams.get('limit') || '20'
  const trackId = searchParams.get('id')

  if (!query && !trackId) {
    return new Response('Missing query or track ID', { status: 400 })
  }

  try {
    // Check if credentials exist
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error('Missing Spotify credentials')
      return new Response('Missing Spotify credentials', { status: 500 })
    }

    // Get client credentials token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`)}`
      },
      body: 'grant_type=client_credentials'
    })

    if (!tokenResponse.ok) {
      console.error('Token request failed:', tokenResponse.status, tokenResponse.statusText)
      return new Response('Spotify authentication failed', { status: 500 })
    }

    const tokenData = await tokenResponse.json() as { access_token: string }
    const { access_token } = tokenData

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