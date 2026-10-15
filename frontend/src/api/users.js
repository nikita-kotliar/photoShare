import { api } from './client.js';
import { store } from '../store/index.js';

export const usersApi = {
  profile: (username) => api.get(`/users/${username}`).then((r) => r.user),
  photos: (username, query) => api.get(`/users/${username}/photos`, { query }),
  async updateMe(data) {
    const { user } = await api.put('/users/me', data);
    store.set({ user });
    return user;
  },
};
