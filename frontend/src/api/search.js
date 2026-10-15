import { api } from './client.js';

export const searchApi = {
  photos: (query) => api.get('/search/photos', { query }),
};
