import { api } from './client.js';

// form-data для POST /photos: теги і трансформації йдуть JSON-рядками (docs/API.md)
export function photoFormData({ file, description, tags = [], transformations } = {}) {
  const data = new FormData();
  data.append('image', file);
  data.append('description', description);
  if (tags.length) data.append('tags', JSON.stringify(tags));
  if (transformations && Object.keys(transformations).length) {
    data.append('transformations', JSON.stringify(transformations));
  }
  return data;
}

export const photosApi = {
  feed: (query, options) => api.get('/photos', { ...options, query }),
  get: (idOrSlug) => api.get(`/photos/${idOrSlug}`).then((r) => r.photo),
  create: (formData, options) => api.upload('/photos', formData, options).then((r) => r.photo),
  update: (id, data) => api.put(`/photos/${id}`, data).then((r) => r.photo),
  remove: (id) => api.delete(`/photos/${id}`),
  links: (id) => api.get(`/photos/${id}/links`).then((r) => r.items),
  createLink: (id, transformations) =>
    api.post(`/photos/${id}/links`, { transformations }).then((r) => r.link),
};
