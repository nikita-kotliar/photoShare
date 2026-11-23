import { api } from './client.js';

export const aiApi = {
  // POST /api/ai/describe (multipart, поле image) -> { description, tags } (docs/API.md)
  describe(file, { signal } = {}) {
    const data = new FormData();
    data.append('image', file);
    return api.upload('/ai/describe', data, { signal });
  },
};
