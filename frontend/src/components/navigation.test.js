import { describe, expect, it } from 'vitest';
import { isStaff, navItems, profileHref } from './navigation.js';

const labels = (user) => navItems(user).map((item) => item.label);
const item = (user, label) => navItems(user).find((entry) => entry.label === label);

describe('navItems', () => {
  it('показує «Користувачі» лише ADMIN і MODERATOR', () => {
    expect(labels(null)).toEqual(['Світлини', 'Мій профіль', 'Про нас']);
    expect(labels({ username: 'ivan', role: 'USER' })).not.toContain('Користувачі');
    expect(labels({ username: 'ann', role: 'ADMIN' })).toContain('Користувачі');
    expect(labels({ username: 'val', role: 'MODERATOR' })).toContain('Користувачі');
  });

  it('підсвічує активний пункт', () => {
    const user = { username: 'ivan', role: 'USER' };
    expect(item(user, 'Світлини').isActive('/home')).toBe(true);
    expect(item(user, 'Світлини').isActive('/photos/abc')).toBe(true);
    expect(item(user, 'Мій профіль').isActive('/users/ivan')).toBe(true);
    expect(item(user, 'Мій профіль').isActive('/users/anna')).toBe(false);
    expect(item(null, 'Мій профіль').isActive('/auth')).toBe(false);
    expect(item(user, 'Про нас').isActive('/about')).toBe(true);
  });
});

describe('profileHref', () => {
  it('веде гостя на вхід', () => {
    expect(profileHref(null)).toBe('/auth');
    expect(profileHref({ username: 'ivan' })).toBe('/users/ivan');
  });
});

describe('isStaff', () => {
  it('визначає персонал', () => {
    expect(isStaff({ role: 'ADMIN' })).toBe(true);
    expect(isStaff({ role: 'USER' })).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
});
