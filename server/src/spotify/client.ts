let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('Failed to fetch Spotify token');
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: { name: string }[];
  release_date: string;
  images: { url: string }[];
  genres: string[];
  total_tracks: number;
  external_urls: { spotify: string };
}

export async function searchAlbums(query: string, limit = 10): Promise<SpotifyAlbum[]> {
  const token = await getSpotifyToken();
  const params = new URLSearchParams({ q: query, type: 'album', limit: String(limit), market: 'US' });
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Spotify search failed');
  const data = (await res.json()) as { albums: { items: SpotifyAlbum[] } };
  return data.albums.items;
}

export async function getAlbum(id: string): Promise<SpotifyAlbum> {
  const token = await getSpotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify album fetch failed: ${res.status}`);
  return res.json() as Promise<SpotifyAlbum>;
}

export async function getSpotifyPlaylist(playlistId: string) {
  const token = await getSpotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Spotify playlist fetch failed');
  return res.json();
}

// Uses Spotify search tag:new to get this week's freshest releases
export async function getTrendingAlbums(limit = 6): Promise<SpotifyAlbum[]> {
  const token = await getSpotifyToken();
  const params = new URLSearchParams({
    q: 'tag:new',
    type: 'album',
    limit: '10', // tag:new max is 10
    market: 'US',
  });
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch trending albums');
  const data = (await res.json()) as { albums: { items: SpotifyAlbum[] } };
  const seen = new Set<string>();
  const albums: SpotifyAlbum[] = [];
  for (const album of data.albums.items) {
    if (!album || seen.has(album.id)) continue;
    seen.add(album.id);
    albums.push(album);
    if (albums.length >= limit) break;
  }
  return albums;
}

export function normalizeAlbum(album: SpotifyAlbum) {
  return {
    spotifyAlbumId: album.id,
    name: album.name,
    artist: album.artists.map((a) => a.name).join(', '),
    releaseYear: parseInt(album.release_date.slice(0, 4)),
    coverUrl: album.images[0]?.url ?? '',
    genres: album.genres ?? [],
  };
}
