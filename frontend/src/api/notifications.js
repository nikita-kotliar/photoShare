import { api } from './client.js';

export const notificationsApi = {
  list: (query, options = {}) => api.get('/notifications', { ...options, query }),
  unreadCount: (options = {}) =>
    api.get('/notifications/unread-count', options).then((r) => r.count),
  // Без ids - усі мої сповіщення
  markRead: (ids) => api.post('/notifications/read', ids ? { ids } : {}),
};
