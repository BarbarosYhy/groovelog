import { api } from './client';

export const albumsApi = {
  search: (q: string) =>
    api.get(`/api/albums/search?q=${encodeURIComponent(q)}`).then((r) => r.data),
  getById: (id: string) => api.get(`/api/albums/${id}`).then((r) => r.data),
  getTrending: (limit = 6) =>
    api.get(`/api/albums/trending?limit=${limit}`).then((r) => r.data),
  getTracks: (albumId: string) =>
    api.get(`/api/albums/${albumId}/tracks`).then((r) => r.data as Array<{
      id: string;
      name: string;
      trackNumber: number;
      durationMs: number;
      discNumber: number;
    }>),
};
