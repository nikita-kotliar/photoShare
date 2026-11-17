import { api } from './client.js';

export const searchApi = {
  photos: (query, options) => api.get('/search/photos', { ...options, query }),
};
