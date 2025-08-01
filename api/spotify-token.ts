export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Get client credentials token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`)}`
      },
      body: 'grant_type=client_credentials'
    })

    const tokenData = await tokenResponse.json()

    return new Response(JSON.stringify(tokenData), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=3000' // Cache for 50 minutes (tokens expire in 1 hour)
      }
    })
  } catch (error) {
    return new Response('Internal server error', { status: 500 })
  }
}