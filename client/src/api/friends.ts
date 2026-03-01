import { api } from './client';

export const friendsApi = {
  getStatus: (userId: string) =>
    api.get(`/api/friends/status/${userId}`).then((r) => r.data as {
      status: 'self' | 'none' | 'friends' | 'pending_sent' | 'pending_received';
      friendshipId?: string;
    }),
  getFriends: () =>
    api.get('/api/friends').then((r) => r.data as Array<{
      id: string;
      username: string;
      avatarUrl: string | null;
    }>),
  getRequests: () =>
    api.get('/api/friends/requests').then((r) => r.data as Array<{
      friendshipId: string;
      id: string;
      username: string;
      avatarUrl: string | null;
      createdAt: string;
    }>),
  sendRequest: (userId: string) =>
    api.post(`/api/friends/request/${userId}`).then((r) => r.data),
  accept: (friendshipId: string) =>
    api.post(`/api/friends/accept/${friendshipId}`).then((r) => r.data),
  remove: (userId: string) =>
    api.delete(`/api/friends/${userId}`).then((r) => r.data),
  getRecentReviews: () =>
    api.get('/api/friends/recent-reviews').then((r) => r.data as Array<{
      spotifyAlbumId: string;
      name: string;
      artist: string;
      coverUrl: string;
      releaseYear: number;
      genres: string[];
    }>),
};
