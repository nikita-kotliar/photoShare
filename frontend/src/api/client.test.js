import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './client.js';
import { store } from '../store/index.js';

function respond(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
}

const unauthorized = { error: { code: 'TOKEN_INVALID', message: 'Токен недійсний' } };

describe('request: завершена сесія', () => {
  beforeEach(() => store.set({ user: null, toasts: [], pending: 0 }));
  afterEach(() => vi.unstubAllGlobals());

  it('при 401 виходить з акаунта і показує повідомлення', async () => {
    store.set({ user: { id: 1 } });
    vi.stubGlobal('fetch', respond(401, unauthorized));

    await expect(request('GET', '/photos')).rejects.toMatchObject({ status: 401 });
    expect(store.get().user).toBeNull();
    expect(store.get().toasts.map((toast) => toast.message)).toEqual([
      'Сесія завершилась, увійдіть знову',
    ]);
  });

  it('гостю повідомлення не показує', async () => {
    vi.stubGlobal('fetch', respond(401, unauthorized));
    await expect(request('GET', '/photos')).rejects.toMatchObject({ status: 401 });
    expect(store.get().toasts).toEqual([]);
  });

  it('при перевірці сесії (keepSession) нічого не скидає', async () => {
    store.set({ user: { id: 1 } });
    vi.stubGlobal('fetch', respond(401, unauthorized));
    await expect(request('GET', '/users/me', { keepSession: true })).rejects.toBeTruthy();
    expect(store.get().user).toEqual({ id: 1 });
    expect(store.get().toasts).toEqual([]);
  });

  it('лічильник запитів повертається до нуля', async () => {
    vi.stubGlobal('fetch', respond(200, { ok: true }));
    await request('GET', '/health');
    expect(store.get().pending).toBe(0);
  });
});
