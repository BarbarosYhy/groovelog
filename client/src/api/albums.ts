import { api } from './client';

export const albumsApi = {
  search: (q: string) =>
    api.get(`/api/albums/search?q=${encodeURIComponent(q)}`).then((r) => r.data),
  getById: (id: string) => api.get(`/api/albums/${id}`).then((r) => r.data),
};
