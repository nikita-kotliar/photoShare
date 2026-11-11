import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter } from './index.js';
import { createStore } from '../store/createStore.js';

function fakeOutlet() {
  return {
    children: [],
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    append(node) {
      this.children.push(node);
    },
  };
}

describe('router: помилка сторінки', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { pathname: '/broken', search: '', hash: '' },
      history: { pushState: vi.fn(), replaceState: vi.fn() },
      scrollTo: vi.fn(),
    });
    vi.stubGlobal('document', { title: '' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('показує сторінку помилки, якщо модуль не завантажився', async () => {
    const outlet = fakeOutlet();
    const errorView = { kind: 'error' };
    const renderError = vi.fn(() => errorView);
    const routes = [
      { path: '/broken', load: () => Promise.reject(new Error('chunk failed')) },
      { path: '*', load: async () => ({ default: () => ({ kind: 'not-found' }) }) },
    ];
    const router = createRouter({
      routes,
      outlet,
      store: createStore({ user: null }),
      renderError,
    });

    await router.refresh();

    expect(renderError).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error), retry: expect.any(Function) }),
    );
    expect(outlet.children).toEqual([errorView]);
    expect(document.title).toBe('Помилка | PhotoShare');
  });

  it('показує сторінку помилки, якщо сторінка впала під час рендеру', async () => {
    const outlet = fakeOutlet();
    const errorView = { kind: 'error' };
    const routes = [
      {
        path: '/broken',
        load: async () => ({
          default: () => {
            throw new Error('render failed');
          },
        }),
      },
    ];
    const router = createRouter({
      routes,
      outlet,
      store: createStore({ user: null }),
      renderError: () => errorView,
    });

    await router.refresh();

    expect(outlet.children).toEqual([errorView]);
  });
});
