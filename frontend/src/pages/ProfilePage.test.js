import { describe, expect, it } from 'vitest';
import { formatJoinDate, isOwnProfile, photosCountText, profilePageHref } from './ProfilePage.js';

describe('formatJoinDate', () => {
  it('показує дату як у макеті: дд/мм/рр', () => {
    expect(formatJoinDate(new Date(2025, 2, 3).toISOString())).toBe('03/03/25');
    expect(formatJoinDate('bad')).toBe('');
  });
});

describe('photosCountText', () => {
  it('відмінює кількість світлин', () => {
    expect(photosCountText(1)).toBe('1 завантажене фото');
    expect(photosCountText(3)).toBe('3 завантажені фото');
    expect(photosCountText(12)).toBe('12 завантажених фото');
    expect(photosCountText(undefined)).toBe('0 завантажених фото');
  });
});

describe('isOwnProfile', () => {
  it('власний профіль лише для того самого username', () => {
    expect(isOwnProfile({ username: 'ivan' }, { username: 'ivan' })).toBe(true);
    expect(isOwnProfile({ username: 'ivan' }, { username: 'olena' })).toBe(false);
    expect(isOwnProfile(null, { username: 'ivan' })).toBe(false);
  });
});

describe('profilePageHref', () => {
  it('додає сторінку лише після першої', () => {
    expect(profilePageHref('ivan', 1)).toBe('/users/ivan');
    expect(profilePageHref('ivan', 3)).toBe('/users/ivan?page=3');
    expect(profilePageHref('ivan k', 1)).toBe('/users/ivan%20k');
  });
});
