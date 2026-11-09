import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client.js', () => ({
  api: { delete: vi.fn(), post: vi.fn(), get: vi.fn() },
}));

const { api } = await import('./client.js');
const { authApi } = await import('./auth.js');
const { store } = await import('../store/index.js');

describe('authApi.logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.set({ user: { id: 1, username: 'ivan' } });
  });

  it('викликає DELETE /sessions і очищає користувача в store', async () => {
    api.delete.mockResolvedValue(null);
    await authApi.logout();
    expect(api.delete).toHaveBeenCalledWith('/sessions', { keepSession: true });
    expect(store.get().user).toBeNull();
  });

  it('якщо сервер не відповів, користувач лишається', async () => {
    api.delete.mockRejectedValue(new Error('offline'));
    await expect(authApi.logout()).rejects.toThrow('offline');
    expect(store.get().user).toEqual({ id: 1, username: 'ivan' });
  });
});
