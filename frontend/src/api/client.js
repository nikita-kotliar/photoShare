import { store } from '../store/index.js';

const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
}

function buildUrl(path, query) {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

function changePending(delta) {
  store.set((s) => ({ pending: Math.max(0, s.pending + delta) }));
}

async function parseBody(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function request(method, path, options = {}) {
  const { body, query, signal, keepSession = false } = options;
  const headers = {};
  let payload;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  changePending(1);
  try {
    let response;
    try {
      response = await fetch(buildUrl(path, query), {
        method,
        headers,
        body: payload,
        credentials: 'include',
        signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new ApiError(0, 'NETWORK_ERROR', 'Немає з\u2019єднання з сервером');
    }

    const data = await parseBody(response);

    if (!response.ok) {
      const err = data?.error;
      if (response.status === 401 && !keepSession) {
        store.set({ user: null });
      }
      throw new ApiError(
        response.status,
        err?.code || 'UNKNOWN_ERROR',
        err?.message || 'Щось пішло не так',
        err?.fields,
      );
    }

    return data;
  } finally {
    changePending(-1);
  }
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
};
