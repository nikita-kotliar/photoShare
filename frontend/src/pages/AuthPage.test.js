import { describe, expect, it } from 'vitest';
import { authMode, GOOGLE_ERRORS, googleErrorMessage, registerPayload } from './AuthPage.js';

describe('googleErrorMessage', () => {
  it('без коду - без повідомлення', () => {
    expect(googleErrorMessage(undefined)).toBe('');
    expect(googleErrorMessage('')).toBe('');
  });

  it('відомі коди мають свої тексти', () => {
    expect(googleErrorMessage('cancelled')).toBe(GOOGLE_ERRORS.cancelled);
    expect(googleErrorMessage('banned')).toContain('заблоковано');
  });

  it('невідомий код - загальне повідомлення', () => {
    expect(googleErrorMessage('something_new')).toBe(
      'Не вдалося увійти через Google. Спробуйте ще раз.',
    );
  });
});

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
