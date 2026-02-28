import { api } from './client';

export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post('/api/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data).then((r) => r.data),
  me: () => api.get('/api/auth/me').then((r) => r.data),
};
