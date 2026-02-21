/**
 * AudiusClient — fetches trending/search tracks from the Audius API
 * and provides stream URLs for playback via AudioEngine.
 */

const BASE_URL = 'https://discoveryprovider.audius.co/v1';
const APP_NAME = 'Synestify';

export interface AudiusTrack {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  duration: number; // seconds
  genre?: string;
  streamUrl: string;
}

interface AudiusApiTrack {
  track_id: string;
  title: string;
  user: { name: string; handle: string };
  artwork?: { '150x150'?: string; '480x480'?: string; '1000x1000'?: string };
  duration: number;
  genre?: string;
}

interface AudiusApiResponse {
  data: AudiusApiTrack[];
}

function mapTrack(raw: AudiusApiTrack): AudiusTrack {
  const artwork = raw.artwork?.['480x480'] || raw.artwork?.['1000x1000'] || raw.artwork?.['150x150'];
  return {
    id: String(raw.track_id),
    title: raw.title,
    artist: raw.user?.name || raw.user?.handle || 'Unknown',
    artworkUrl: artwork,
    duration: raw.duration,
    genre: raw.genre,
    streamUrl: `${BASE_URL}/tracks/${raw.track_id}/stream?app_name=${APP_NAME}`,
  };
}

export class AudiusClient {
  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Audius API error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  async getTrending(limit = 20): Promise<AudiusTrack[]> {
    const url = `${BASE_URL}/tracks/trending?app_name=${APP_NAME}&limit=${limit}`;
    const resp = await this.fetchJson<AudiusApiResponse>(url);
    return resp.data.map(mapTrack);
  }

  async search(query: string, limit = 20): Promise<AudiusTrack[]> {
    const encoded = encodeURIComponent(query);
    const url = `${BASE_URL}/tracks/search?query=${encoded}&app_name=${APP_NAME}&limit=${limit}`;
    const resp = await this.fetchJson<AudiusApiResponse>(url);
    return resp.data.map(mapTrack);
  }

  getStreamUrl(trackId: string): string {
    return `${BASE_URL}/tracks/${trackId}/stream?app_name=${APP_NAME}`;
  }
}
