import { api } from './client.js';
import { store } from '../store/index.js';

export const authApi = {
  async register(data) {
    const { user } = await api.post('/users', data, { keepSession: true });
    store.set({ user });
    return user;
  },

  async login(data) {
    const { user } = await api.post('/sessions', data, { keepSession: true });
    store.set({ user });
    return user;
  },

  async logout() {
    await api.delete('/sessions', { keepSession: true });
    store.set({ user: null });
  },

  async me() {
    const { user } = await api.get('/users/me', { keepSession: true });
    return user;
  },
};
