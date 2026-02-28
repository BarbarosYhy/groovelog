import { api } from './client';

export const listeningApi = {
  addToList: (spotifyAlbumId: string, status: 'want' | 'listened') =>
    api.post('/api/listening/list', { spotifyAlbumId, status }).then((r) => r.data),
  getList: (userId: string) =>
    api.get(`/api/listening/${userId}`).then((r) => r.data),
  addLog: (data: { spotifyAlbumId: string; listenedOn: string; notes?: string }) =>
    api.post('/api/listening/log', data).then((r) => r.data),
};
