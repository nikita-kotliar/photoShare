import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  THEME_KEY,
  applyTheme,
  normalizeTheme,
  onThemeChange,
  readTheme,
  resolveTheme,
  setTheme,
  toggledTheme,
} from './theme.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => (data[key] = value),
    removeItem: (key) => delete data[key],
  };
}

const win = (dark) => ({ matchMedia: () => ({ matches: dark }) });

describe('тема', () => {
  it('невідоме значення - як у системі', () => {
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('pink')).toBe('system');
    expect(normalizeTheme(null)).toBe('system');
  });

  it('читає збережений вибір, а без сховища - як у системі', () => {
    expect(readTheme(memoryStorage({ [THEME_KEY]: 'light' }))).toBe('light');
    expect(readTheme(memoryStorage())).toBe('system');
    const broken = {
      getItem() {
        throw new Error('blocked');
      },
    };
    expect(readTheme(broken)).toBe('system');
  });

  it('«як у системі» бере тему з налаштувань системи', () => {
    expect(resolveTheme('system', win(true))).toBe('dark');
    expect(resolveTheme('system', win(false))).toBe('light');
    expect(resolveTheme('light', win(true))).toBe('light');
  });

  it('перемикач змінює тему на протилежну до видимої', () => {
    expect(toggledTheme('system', win(true))).toBe('light');
    expect(toggledTheme('system', win(false))).toBe('dark');
    expect(toggledTheme('dark', win(false))).toBe('light');
  });

  it('зберігає вибір, ставить атрибут і повідомляє підписників', () => {
    const store = memoryStorage();
    const root = { dataset: {} };
    const listener = vi.fn();
    const stop = onThemeChange(listener);

    setTheme('dark', { store, root });
    expect(store.data[THEME_KEY]).toBe('dark');
    expect(root.dataset.theme).toBe('dark');
    expect(listener).toHaveBeenCalledWith('dark');

    setTheme('system', { store, root });
    expect(store.data[THEME_KEY]).toBeUndefined();
    expect(root.dataset.theme).toBeUndefined();
    stop();
  });

  it('applyTheme без документа нічого не ламає', () => {
    expect(() => applyTheme('dark', null)).not.toThrow();
  });
});

describe('змінні темної теми', () => {
  it('ручна темна тема і системна мають однакові значення', () => {
    const css = readFileSync(new URL('../styles/variables.css', import.meta.url), 'utf8');
    const block = (start) => {
      const from = css.indexOf('{', css.indexOf(start)) + 1;
      return css
        .slice(from, css.indexOf('}', from))
        .split(';')
        .map((line) => line.trim())
        .filter(Boolean);
    };
    const manual = block(":root[data-theme='dark']");
    const system = block(":root:not([data-theme='light'])");
    expect(manual.length).toBeGreaterThan(20);
    expect(system).toEqual(manual);
  });
});
