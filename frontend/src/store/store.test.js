import { describe, it, expect, vi } from 'vitest';
import { createStore } from './createStore.js';

describe('createStore', () => {
  it('повертає початковий стан і оновлює його', () => {
    const store = createStore({ count: 0 });
    store.set({ count: 1 });
    expect(store.get().count).toBe(1);
  });

  it('підтримує функціональне оновлення', () => {
    const store = createStore({ count: 1 });
    store.set((s) => ({ count: s.count + 1 }));
    expect(store.get().count).toBe(2);
  });

  it('сповіщає підписників', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ count: 5 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('селектор не викликає підписника, якщо значення не змінилось', () => {
    const store = createStore({ a: 1, b: 1 });
    const listener = vi.fn();
    store.subscribe(listener, (s) => s.a);
    store.set({ b: 2 });
    expect(listener).not.toHaveBeenCalled();
    store.set({ a: 2 });
    expect(listener).toHaveBeenCalledWith(2, expect.any(Object));
  });

  it('відписка зупиняє сповіщення', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ count: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});
