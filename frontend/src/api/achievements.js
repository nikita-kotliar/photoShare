import { api } from './client.js';

export const achievementsApi = {
  list: (username, options = {}) =>
    api.get(`/users/${encodeURIComponent(username)}/achievements`, options).then((r) => r.items),
};
