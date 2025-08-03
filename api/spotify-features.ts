export const config = { runtime: 'edge' }

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

    // Get audio features using batch endpoint (non-deprecated)
    console.log(`Fetching audio features from: https://api.spotify.com/v1/audio-features?ids=${trackId}`)
    const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackId}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })

    console.log(`Audio features response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Audio features request failed:', response.status, response.statusText, errorText)
      return new Response(JSON.stringify({ 
        error: 'Failed to get audio features',
        details: `${response.status} ${response.statusText}`,
        trackId: trackId,
        timestamp: new Date().toISOString()
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const data = await response.json()
    console.log('Audio features retrieved successfully')
    
    // Extract first feature object from batch response
    const features = data.audio_features && data.audio_features.length > 0 
      ? data.audio_features[0] 
      : null

    if (!features) {
      return new Response(JSON.stringify({ 
        error: 'No audio features available for this track',
        trackId: trackId,
        timestamp: new Date().toISOString()
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

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