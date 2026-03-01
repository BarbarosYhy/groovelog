import { api } from './client';

export const spotifyApi = {
  connect: () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/spotify/connect`;
  },
  getRecentlyPlayed: () =>
    api.get('/api/spotify/recently-played').then((r) => r.data as Array<{
      albumId: string;
      albumName: string;
      playedAt: string;
    }>),
};
