import { api } from './client';

export const reviewsApi = {
  create: (data: object) => api.post('/api/reviews', data).then((r) => r.data),
  getForAlbum: (albumId: string) =>
    api.get(`/api/reviews/album/${albumId}`).then((r) => r.data),
  getById: (id: string) => api.get(`/api/reviews/${id}`).then((r) => r.data),
  update: (id: string, data: object) =>
    api.put(`/api/reviews/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/reviews/${id}`),
  toggleLike: (id: string) =>
    api.post(`/api/reviews/${id}/like`).then((r) => r.data),
  addComment: (data: { reviewId: string; bodyText: string }) =>
    api.post('/api/comments', data).then((r) => r.data),
};
