import { api, apiUrl } from './client.js';
import { store } from '../store/index.js';

export const authApi = {
  // Вхід через Google - перехід браузером: бекенд веде на Google, а після згоди повертає
  // на /home з cookie сесії або на /auth?googleError=<код> (docs/API.md)
  googleUrl: () => apiUrl('/auth/google'),

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
    const { user } = await api.get('/sessions', { keepSession: true });
    return user;
  },
};
