import { api } from './client.js';

export const adminApi = {
  users: (query) => api.get('/admin/users', { query }),
  setStatus: (id, isActive) =>
    api.patch(`/admin/users/${id}/status`, { isActive }).then((r) => r.user),
};
