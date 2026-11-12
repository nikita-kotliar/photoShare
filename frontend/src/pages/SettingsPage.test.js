import { describe, expect, it } from 'vitest';
import { formatJoined, profileChanges, profileErrors } from './SettingsPage.js';
import { schemas, validateForm } from '../validation/index.js';

const user = {
  name: 'Ксенія',
  username: 'ksenia',
  email: 'ksenia@example.com',
  bio: 'Фотографую море',
};

describe('profileChanges', () => {
  it('нічого не надсилає без змін, з урахуванням пробілів і регістру email', () => {
    expect(
      profileChanges(
        {
          name: ' Ксенія ',
          username: 'ksenia',
          email: 'Ksenia@Example.com',
          bio: 'Фотографую море ',
        },
        user,
      ),
    ).toEqual({});
  });

  it('надсилає лише змінені поля, обрізані', () => {
    expect(profileChanges({ ...user, name: ' Нове ім’я ', username: 'new_nick' }, user)).toEqual({
      name: 'Нове ім’я',
      username: 'new_nick',
    });
  });

  it('очищене «про себе» йде порожнім рядком, щоб сервер його стер', () => {
    expect(profileChanges({ ...user, bio: '   ' }, user)).toEqual({ bio: '' });
    expect(profileChanges({ ...user, bio: '' }, { ...user, bio: null })).toEqual({});
  });
});

describe('profileErrors', () => {
  it('409: зайнятий юзернейм чи email під полем', () => {
    expect(
      profileErrors({
        status: 409,
        message: 'Користувач вже існує',
        fields: { username: 'Зайнятий' },
      }),
    ).toEqual({ fields: { username: 'Зайнятий' }, message: '' });
  });

  it('невідомі поля і помилки без полів - одним повідомленням', () => {
    expect(profileErrors({ status: 422, fields: { avatar: 'Ні' } })).toEqual({
      fields: {},
      message: 'Ні',
    });
    expect(profileErrors({ status: 422, message: 'Вкажіть хоча б одне поле' }).message).toBe(
      'Вкажіть хоча б одне поле',
    );
    expect(profileErrors({ status: 0, message: 'Немає з’єднання' }).message).toBe(
      'Немає з’єднання',
    );
    expect(profileErrors({ status: 500, message: 'stack' }).message).toBe(
      'Не вдалося зберегти профіль, спробуйте ще раз',
    );
  });
});

describe('schemas.profile', () => {
  it('«про себе» необов’язкове, до 300 символів', () => {
    const base = { name: 'Ксенія', username: 'ksenia', email: 'k@example.com' };
    expect(validateForm({ ...base, bio: '' }, schemas.profile).valid).toBe(true);
    expect(validateForm({ ...base, bio: 'x'.repeat(300) }, schemas.profile).valid).toBe(true);
    expect(validateForm({ ...base, bio: 'x'.repeat(301) }, schemas.profile).errors.bio).toBe(
      'Максимум 300 символів',
    );
  });
});

describe('formatJoined', () => {
  it('форматує дату реєстрації як у макеті', () => {
    expect(formatJoined(new Date(2025, 2, 3).toISOString())).toBe('03/03/25');
    expect(formatJoined('bad')).toBe('');
  });
});
