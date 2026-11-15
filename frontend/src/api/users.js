import { api } from './client.js';
import { store } from '../store/index.js';

export const usersApi = {
  profile: (username, options) =>
    api.get(`/users/${encodeURIComponent(username)}`, options).then((r) => r.user),
  photos: (username, query, options) =>
    api.get(`/users/${encodeURIComponent(username)}/photos`, { ...options, query }),
  async updateMe(data) {
    const { user } = await api.put('/users/me', data);
    store.set({ user });
    return user;
  },
};
