import { api } from './client';

export const spotifyApi = {
  connect: () => {
    const token = localStorage.getItem('token');
    window.location.href = `${import.meta.env.VITE_API_URL}/api/spotify/connect?token=${token}`;
  },
  getRecentlyPlayed: () =>
    api.get('/api/spotify/recently-played').then((r) => r.data as Array<{
      albumId: string;
      albumName: string;
      playedAt: string;
    }>),
};
