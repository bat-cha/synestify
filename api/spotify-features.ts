export const config = { runtime: 'edge' }

function generateMockAudioFeatures(track: any, trackId: string) {
  // Generate deterministic but varied features based on track properties
  const seed = trackId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const random = (min: number, max: number, offset = 0) => {
    const val = ((seed + offset) * 9301 + 49297) % 233280
    return min + (val / 233280) * (max - min)
  }
  
  // Base features on track properties
  const duration = track.duration_ms || 200000
  const popularity = track.popularity || 50
  const isExplicit = track.explicit || false
  
  // Longer tracks tend to be more acoustic, shorter more energetic
  const durationFactor = Math.min(duration / 300000, 1) // normalized to 5 min
  
  return {
    acousticness: random(0.1, 0.9, 1) * (durationFactor * 0.7 + 0.3),
    danceability: random(0.3, 0.9, 2) * (popularity / 100 * 0.6 + 0.4),
    energy: random(0.2, 0.95, 3) * (1 - durationFactor * 0.4),
    instrumentalness: random(0.0, 0.3, 4) * (durationFactor * 0.8 + 0.2),
    liveness: random(0.05, 0.35, 5),
    loudness: random(-20, -3, 6),
    speechiness: random(0.03, 0.2, 7) * (isExplicit ? 1.5 : 1),
    valence: random(0.1, 0.9, 8) * (popularity / 100 * 0.7 + 0.3),
    tempo: random(60, 180, 9),
    key: Math.floor(random(0, 12, 10)),
    mode: Math.floor(random(0, 2, 11)),
    time_signature: [3, 4, 4, 4, 5][Math.floor(random(0, 5, 12))], // weighted toward 4/4
    duration_ms: duration,
    analysis_url: null,
    id: trackId,
    track_href: `https://api.spotify.com/v1/tracks/${trackId}`,
    type: "audio_features",
    uri: `spotify:track:${trackId}`
  }
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url)
  const trackId = searchParams.get('id')

  if (!trackId) {
    return new Response(JSON.stringify({ error: 'Missing track ID' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    // Check if credentials exist
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error('Missing Spotify credentials for audio features')
      return new Response(JSON.stringify({ 
        error: 'Missing Spotify credentials',
        timestamp: new Date().toISOString()
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`Getting audio features for track: ${trackId}`)

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
      const errorText = await tokenResponse.text()
      console.error('Token request failed for audio features:', tokenResponse.status, tokenResponse.statusText, errorText)
      return new Response(JSON.stringify({ 
        error: 'Spotify authentication failed',
        details: `${tokenResponse.status} ${tokenResponse.statusText}`,
        timestamp: new Date().toISOString()
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const tokenData = await tokenResponse.json() as { access_token: string }
    const { access_token } = tokenData

    console.log('Token obtained successfully for audio features')

    // Since Spotify audio features endpoints are deprecated/restricted,
    // generate realistic mock data based on track metadata
    console.log('Generating mock audio features based on track metadata')
    
    // Get track info to base mock features on
    const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })
    
    if (!trackResponse.ok) {
      return new Response(JSON.stringify({ 
        error: 'Failed to get track info',
        details: `${trackResponse.status} ${trackResponse.statusText}`,
        trackId: trackId,
        timestamp: new Date().toISOString()
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const track = await trackResponse.json()
    const features = generateMockAudioFeatures(track, trackId)

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