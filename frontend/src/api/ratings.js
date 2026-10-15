import { api } from './client.js';

export const ratingsApi = {
  rate: (photoId, value) => api.post(`/photos/${photoId}/ratings`, { value }),
  list: (photoId, query) => api.get(`/photos/${photoId}/ratings`, { query }),
  remove: (id) => api.delete(`/ratings/${id}`),
};
