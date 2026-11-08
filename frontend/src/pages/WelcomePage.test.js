import { describe, expect, it } from 'vitest';
import { welcomeActions } from './WelcomePage.js';

describe('welcomeActions', () => {
  it('веде гостя на вхід і реєстрацію', () => {
    expect(welcomeActions(null).map((action) => action.href)).toEqual([
      '/auth',
      '/auth?tab=register',
    ]);
  });

  it('повертає користувача до світлин', () => {
    expect(welcomeActions({ id: 1 })).toEqual([{ text: 'Повернутися до світлин', href: '/home' }]);
  });
});
