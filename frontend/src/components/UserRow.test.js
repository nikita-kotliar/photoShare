import { describe, expect, it } from 'vitest';
import { canChangeStatus, formatUserDate, roleAction, statusAction } from './UserRow.js';

const admin = { id: 1, role: 'ADMIN' };
const moderator = { id: 2, role: 'MODERATOR' };

describe('canChangeStatus', () => {
  it('ADMIN банить користувачів і модераторів', () => {
    expect(canChangeStatus(admin, { id: 3, role: 'USER' })).toBe(true);
    expect(canChangeStatus(admin, { id: 2, role: 'MODERATOR' })).toBe(true);
  });

  it('не себе, не іншого ADMIN і не для MODERATOR', () => {
    expect(canChangeStatus(admin, { id: 1, role: 'ADMIN' })).toBe(false);
    expect(canChangeStatus(admin, { id: 5, role: 'ADMIN' })).toBe(false);
    expect(canChangeStatus(moderator, { id: 3, role: 'USER' })).toBe(false);
    expect(canChangeStatus(null, { id: 3, role: 'USER' })).toBe(false);
  });
});

describe('statusAction', () => {
  it('активного банять, забаненого розблоковують', () => {
    expect(statusAction({ isActive: true }).value).toBe('ban');
    expect(statusAction({ isActive: false })).toMatchObject({
      value: 'unban',
      label: 'Розблокувати користувача',
    });
  });
});

describe('roleAction', () => {
  it('користувача призначають модератором, модератора повертають у користувачі', () => {
    expect(roleAction({ role: 'USER' }).value).toBe('promote');
    expect(roleAction({ role: 'MODERATOR' })).toMatchObject({
      value: 'demote',
      label: 'Зняти роль модератора',
    });
  });
});

describe('formatUserDate', () => {
  it('дата як у макеті: дд.мм.рр гг:хх', () => {
    expect(formatUserDate(new Date(2025, 1, 10, 20, 40).toISOString())).toBe('10.02.25 20:40');
    expect(formatUserDate('bad')).toBe('');
  });
});
