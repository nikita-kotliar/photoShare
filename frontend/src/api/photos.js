import { api } from './client.js';

export const photosApi = {
  feed: (query, options) => api.get('/photos', { ...options, query }),
  get: (idOrSlug) => api.get(`/photos/${idOrSlug}`).then((r) => r.photo),
  create: (formData) => api.post('/photos', formData).then((r) => r.photo),
  update: (id, data) => api.put(`/photos/${id}`, data).then((r) => r.photo),
  remove: (id) => api.delete(`/photos/${id}`),
  links: (id) => api.get(`/photos/${id}/links`).then((r) => r.items),
  createLink: (id, transformations) =>
    api.post(`/photos/${id}/links`, { transformations }).then((r) => r.link),
};
