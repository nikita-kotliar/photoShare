import { describe, it, expect } from 'vitest';
import {
  required,
  email,
  minLength,
  maxLength,
  pattern,
  matches,
  validateField,
  validateForm,
  validateTags,
  normalizeTags,
  cleanValues,
  pluralize,
  schemas,
} from './index.js';

describe('правила', () => {
  it('required: порожнє і пробіли дають помилку', () => {
    expect(required()('')).toBe('Це поле обов’язкове');
    expect(required()('   ')).toBe('Це поле обов’язкове');
    expect(required()(undefined)).toBe('Це поле обов’язкове');
    expect(required()('a')).toBe('');
  });

  it('email', () => {
    expect(email()('user@example.com')).toBe('');
    expect(email()(' user@example.com ')).toBe('');
    expect(email()('user@example')).toBe('Введіть коректний email');
    expect(email()('user example.com')).toBe('Введіть коректний email');
    expect(email()('')).toBe('');
  });

  it('minLength / maxLength з відмінюванням', () => {
    expect(minLength(3)('ab')).toBe('Мінімум 3 символи');
    expect(minLength(8)('abc')).toBe('Мінімум 8 символів');
    expect(minLength(1)('')).toBe('');
    expect(maxLength(30)('a'.repeat(31))).toBe('Максимум 30 символів');
    expect(maxLength(21)('a'.repeat(22))).toBe('Максимум 21 символ');
    expect(maxLength(3)('abc')).toBe('');
  });

  it('trim: за замовчуванням пробіли не рахуються, для паролів можна вимкнути', () => {
    expect(minLength(3)('a  ')).toBe('Мінімум 3 символи');
    expect(minLength(3, { trim: false })('a  ')).toBe('');
  });

  it('pattern', () => {
    const rule = pattern(/^[a-z]+$/, 'Лише літери');
    expect(rule('abc')).toBe('');
    expect(rule('ab1')).toBe('Лише літери');
    expect(rule('')).toBe('');
  });

  it('matches: збіг з іншим полем', () => {
    expect(matches('password')('abc', { password: 'abc' })).toBe('');
    expect(matches('password')('abd', { password: 'abc' })).toBe('Паролі не збігаються');
  });

  it('pluralize', () => {
    const forms = ['символ', 'символи', 'символів'];
    expect([1, 2, 5, 11, 12, 21, 22, 25].map((n) => pluralize(n, forms))).toEqual([
      'символ',
      'символи',
      'символів',
      'символів',
      'символів',
      'символ',
      'символи',
      'символів',
    ]);
  });
});

describe('validateField / validateForm', () => {
  it('validateField повертає першу помилку', () => {
    expect(validateField('', [required(), email()])).toBe('Це поле обов’язкове');
    expect(validateField('abc', [required(), email()])).toBe('Введіть коректний email');
  });

  it('validateForm збирає помилки по полях', () => {
    const { valid, errors } = validateForm({ email: 'x', password: '' }, schemas.login);
    expect(valid).toBe(false);
    expect(errors).toEqual({
      email: 'Введіть коректний email',
      password: 'Це поле обов’язкове',
    });
  });

  it('реєстрація: коректні дані проходять', () => {
    const values = {
      username: 'ksenia_31',
      email: 'k@example.com',
      name: '',
      password: 'password123',
      passwordConfirm: 'password123',
    };
    expect(validateForm(values, schemas.register)).toEqual({ valid: true, errors: {} });
  });

  it('реєстрація: типові помилки', () => {
    const { errors } = validateForm(
      {
        username: 'a b',
        email: 'k@example.com',
        name: '',
        password: 'short',
        passwordConfirm: 'other',
      },
      schemas.register,
    );
    expect(errors.username).toBe('Лише латинські літери, цифри та символи _ . -');
    expect(errors.password).toBe('Мінімум 8 символів');
    expect(errors.passwordConfirm).toBe('Паролі не збігаються');
    expect(errors.email).toBe(undefined);
  });

  it('пароль довший за 72 символи відхиляється', () => {
    const { errors } = validateForm(
      { username: 'abc', email: 'a@b.cc', password: 'a'.repeat(73), passwordConfirm: 'a'.repeat(73) },
      schemas.register,
    );
    expect(errors.password).toBe('Максимум 72 символи');
  });
});

describe('cleanValues', () => {
  it('порожнє необов’язкове name при реєстрації не відправляється', () => {
    const values = {
      username: 'ksenia_31',
      email: 'k@example.com',
      name: '',
      password: 'password123',
      passwordConfirm: 'password123',
    };
    const result = cleanValues(values, schemas.register);
    expect('name' in result).toBe(false);
    expect(result.username).toBe('ksenia_31');
  });

  it('name з одних пробілів теж пропускається', () => {
    expect('name' in cleanValues({ name: '   ' }, schemas.register)).toBe(false);
  });

  it('заповнене name лишається', () => {
    expect(cleanValues({ name: 'Ксенія' }, schemas.register).name).toBe('Ксенія');
  });

  it('обов’язкові поля не прибираються, навіть порожні (їх зловить валідація)', () => {
    expect(cleanValues({ email: '' }, schemas.login)).toEqual({ email: '' });
  });

  it('поле, якого немає в схемі, не чіпаємо', () => {
    expect(cleanValues({ other: '' }, schemas.login)).toEqual({ other: '' });
  });
});

describe('normalizeTags / validateTags', () => {
  it('прибирає порожні, пробіли, регістр і дублікати, порядок зберігає', () => {
    expect(normalizeTags(['Море', ' море ', '', '   ', 'Небо', 'небо', 'гори'])).toEqual([
      'море',
      'небо',
      'гори',
    ]);
  });

  it('не більше 5 тегів', () => {
    expect(validateTags(['a', 'b', 'c', 'd', 'e'])).toBe('');
    expect(validateTags(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('Не більше 5 тегів');
  });

  it('порожні і повторні теги не рахуються в ліміті', () => {
    expect(validateTags(['a', 'a', 'A', '', ' ', 'b', 'c', 'd', 'e'])).toBe('');
  });

  it('тег довший за 30 символів', () => {
    expect(validateTags(['a'.repeat(31)])).toBe('Тег: максимум 30 символів');
  });
});
