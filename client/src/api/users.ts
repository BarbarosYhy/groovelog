import { api } from './client';

export const usersApi = {
  getProfile: (username: string) =>
    api.get(`/api/users/${username}`).then((r) => r.data),
  toggleFollow: (id: string) =>
    api.post(`/api/users/${id}/follow`).then((r) => r.data),
  getFeed: (userId: string) =>
    api.get(`/api/users/${userId}/feed`).then((r) => r.data),
  getWantList: (username: string) =>
    api.get(`/api/users/${username}/want-list`).then((r) => r.data as Array<{
      spotifyAlbumId: string;
      name: string;
      artist: string;
      coverUrl: string;
      releaseYear: number;
      addedAt: string;
    }>),
  search: (q: string) =>
    api.get(`/api/users/search?q=${encodeURIComponent(q)}`).then((r) => r.data as Array<{
      id: string;
      username: string;
      avatarUrl: string | null;
    }>),
  getReviews: (username: string) =>
    api.get(`/api/users/${username}/reviews`).then((r) => r.data),
  getTopGenres: (username: string) =>
    api.get(`/api/users/${username}/top-genres`).then((r) => r.data as {
      connected: boolean;
      genres?: Array<{ name: string; count: number; percentage: number }>;
    }),
  getCompatibility: (username: string) =>
    api.get(`/api/users/${username}/compatibility`).then((r) => r.data as {
      score: number;
      sharedGenres: string[];
      myTopGenre: string | null;
      theirTopGenre: string | null;
    }),
};
