import { describe, expect, it } from 'vitest';
import { canAnimate, homeAction } from './NotFoundPage.js';

describe('homeAction', () => {
  it('повертає користувача до стрічки', () => {
    expect(homeAction({ id: 1 })).toEqual({ text: 'Повернутися до світлин', href: '/home' });
  });

  it('гостя веде на стартову', () => {
    expect(homeAction(null)).toEqual({ text: 'Повернутися на головну', href: '/' });
    expect(homeAction(undefined).href).toBe('/');
  });
});

describe('canAnimate', () => {
  const win = (reduce) => ({ matchMedia: () => ({ matches: reduce }) });

  it('вимикає анімацію, якщо в системі ввімкнено «менше руху»', () => {
    expect(canAnimate(win(true))).toBe(false);
    expect(canAnimate(win(false))).toBe(true);
  });
});
