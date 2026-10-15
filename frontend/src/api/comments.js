import { api } from './client.js';

export const commentsApi = {
  list: (photoId, query) => api.get(`/photos/${photoId}/comments`, { query }),
  create: (photoId, text) =>
    api.post(`/photos/${photoId}/comments`, { text }).then((r) => r.comment),
  update: (id, text) => api.put(`/comments/${id}`, { text }).then((r) => r.comment),
  remove: (id) => api.delete(`/comments/${id}`),
};
