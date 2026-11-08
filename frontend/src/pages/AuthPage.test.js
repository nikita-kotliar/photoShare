import { describe, expect, it } from 'vitest';
import { authMode, registerPayload } from './AuthPage.js';

describe('authMode', () => {
  it('відкриває реєстрацію за ?tab=register', () => {
    expect(authMode({ tab: 'register' })).toBe('register');
    expect(authMode({})).toBe('login');
    expect(authMode({ tab: 'other' })).toBe('login');
  });
});

describe('registerPayload', () => {
  it('не відправляє підтвердження пароля і порожнє ім’я', () => {
    const values = {
      username: 'ivan',
      email: 'i@x.ua',
      password: 'password1',
      passwordConfirm: 'password1',
    };
    expect(registerPayload(values)).toEqual({
      username: 'ivan',
      email: 'i@x.ua',
      password: 'password1',
    });
    expect(registerPayload({ ...values, name: 'Іван' })).toEqual({
      username: 'ivan',
      email: 'i@x.ua',
      password: 'password1',
      name: 'Іван',
    });
  });
});
