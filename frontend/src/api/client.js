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
    if (!response.ok) throw toApiError(response.status, data, keepSession);
    return data;
  } finally {
    changePending(-1);
  }
}

function toApiError(status, data, keepSession) {
  const err = data?.error;
  if (status === 401 && !keepSession) {
    store.set({ user: null });
  }
  if (status === 413 && !err) {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Файл завеликий (максимум 10 МБ)');
  }
  return new ApiError(
    status,
    err?.code || 'UNKNOWN_ERROR',
    err?.message || 'Щось пішло не так',
    err?.fields,
  );
}

function parseText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Відправлення FormData з прогресом. fetch не повідомляє, скільки байтів уже пішло,
// тому тут XMLHttpRequest. onProgress(частка від 0 до 1) викликається під час відправлення файлу.
export function upload(path, formData, { onProgress, signal, keepSession = false } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path));
    xhr.withCredentials = true;

    const done = () => {
      changePending(-1);
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => xhr.abort();
    signal?.addEventListener('abort', abort);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      });
    }
    xhr.addEventListener('load', () => {
      done();
      const data = parseText(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(toApiError(xhr.status, data, keepSession));
    });
    xhr.addEventListener('error', () => {
      done();
      reject(new ApiError(0, 'NETWORK_ERROR', 'Немає з’єднання з сервером'));
    });
    xhr.addEventListener('abort', () => {
      done();
      reject(new DOMException('Aborted', 'AbortError'));
    });

    changePending(1);
    xhr.send(formData);
  });
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
  upload: (path, formData, options) => upload(path, formData, options),
};
