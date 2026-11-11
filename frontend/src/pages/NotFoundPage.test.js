import { describe, expect, it } from 'vitest';
import { homeAction } from './NotFoundPage.js';

describe('homeAction', () => {
  it('повертає користувача до стрічки', () => {
    expect(homeAction({ id: 1 })).toEqual({ text: 'Повернутися до світлин', href: '/home' });
  });

  it('гостя веде на стартову', () => {
    expect(homeAction(null)).toEqual({ text: 'Повернутися на головну', href: '/' });
    expect(homeAction(undefined).href).toBe('/');
  });
});
