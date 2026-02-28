import { api } from './client';

export const usersApi = {
  getProfile: (username: string) =>
    api.get(`/api/users/${username}`).then((r) => r.data),
  toggleFollow: (id: string) =>
    api.post(`/api/users/${id}/follow`).then((r) => r.data),
  getFeed: (userId: string) =>
    api.get(`/api/users/${userId}/feed`).then((r) => r.data),
};
