import { api } from './client';

export const commentsApi = {
  toggleLike: (commentId: string) =>
    api.post(`/api/comments/${commentId}/like`).then((r) => r.data as { liked: boolean }),
};
