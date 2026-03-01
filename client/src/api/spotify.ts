import { api } from './client';

export const spotifyApi = {
  connect: () => {
    const token = localStorage.getItem('token');
    window.location.href = `${import.meta.env.VITE_API_URL}/api/spotify/connect?token=${token}`;
  },
  disconnect: () => api.delete('/api/spotify/disconnect').then((r) => r.data),
  getGlobalTop: () =>
    api.get('/api/spotify/global-top').then((r) => r.data as Array<{
      spotifyAlbumId: string;
      name: string;
      artist: string;
      coverUrl: string;
      releaseYear: number;
      genres: string[];
    }>),
  getRecentlyPlayed: () =>
    api.get('/api/spotify/recently-played').then((r) => r.data as Array<{
      albumId: string;
      albumName: string;
      coverUrl: string;
      artist: string;
      playedAt: string;
    }>),
};
