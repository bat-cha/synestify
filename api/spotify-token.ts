export const config = { runtime: 'edge' }

let cachedToken: { token: string; expires: number } | null = null

export async function getSpotifyToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token
  }

  // Check if credentials exist
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    throw new Error('Missing Spotify credentials')
  }

  // Get new token
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
    console.error('Token request failed:', tokenResponse.status, tokenResponse.statusText, errorText)
    throw new Error(`Spotify authentication failed: ${tokenResponse.status} ${tokenResponse.statusText}`)
  }

  const tokenData = await tokenResponse.json() as { 
    access_token: string
    expires_in: number 
  }

  // Cache the token (expires in 1 hour, we'll cache for 55 minutes to be safe)
  cachedToken = {
    token: tokenData.access_token,
    expires: Date.now() + (tokenData.expires_in - 300) * 1000 // 5 minute buffer
  }

  return tokenData.access_token
}

export default async function handler(req: Request) {
  try {
    const token = await getSpotifyToken()
    return new Response(JSON.stringify({ access_token: token }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=3300' // 55 minutes
      }
    })
  } catch (error) {
    console.error('Token endpoint error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to get token',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}