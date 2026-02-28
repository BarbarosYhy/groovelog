import { api } from './client';

export const playlistsApi = {
  create: (data: object) => api.post('/api/playlists', data).then((r) => r.data),
  getById: (id: string) => api.get(`/api/playlists/${id}`).then((r) => r.data),
  addItem: (id: string, spotifyAlbumId: string) =>
    api.post(`/api/playlists/${id}/items`, { spotifyAlbumId }).then((r) => r.data),
  importFromSpotify: (spotifyPlaylistId: string) =>
    api.post('/api/playlists/import', { spotifyPlaylistId }).then((r) => r.data),
};
