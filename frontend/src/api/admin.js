import { api } from './client.js';

export const adminApi = {
  users: (query, options = {}) => api.get('/admin/users', { ...options, query }),
  setStatus: (id, isActive) =>
    api.patch(`/admin/users/${id}/status`, { isActive }).then((r) => r.user),
  setRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }).then((r) => r.user),
};
