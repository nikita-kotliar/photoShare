import { describe, expect, it } from 'vitest';
import {
  adminApiQuery,
  adminHref,
  confirmText,
  dateRangeLabel,
  hasFilters,
  parseAdminQuery,
  replaceUser,
} from './AdminPage.js';

describe('parseAdminQuery', () => {
  it('без параметрів - значення за замовчуванням', () => {
    expect(parseAdminQuery({})).toEqual({
      q: '',
      role: '',
      from: '',
      to: '',
      sort: 'date',
      page: 1,
    });
  });

  it('бере коректні фільтри з адреси', () => {
    expect(
      parseAdminQuery({
        q: '  олена ',
        role: 'MODERATOR',
        from: '2026-02-01',
        to: '2026-02-10',
        sort: '-name',
        page: '3',
      }),
    ).toEqual({
      q: 'олена',
      role: 'MODERATOR',
      from: '2026-02-01',
      to: '2026-02-10',
      sort: '-name',
      page: 3,
    });
  });

  it('некоректні значення ігнорує, переставлені дати міняє місцями', () => {
    const state = parseAdminQuery({
      role: 'ROOT',
      from: '2026-02-10',
      to: '2026-02-01',
      sort: 'email',
      page: '-1',
    });
    expect(state).toMatchObject({
      role: '',
      from: '2026-02-01',
      to: '2026-02-10',
      sort: 'date',
      page: 1,
    });
    expect(parseAdminQuery({ from: '10.02.2026', to: '2026-13-45' })).toMatchObject({
      from: '',
      to: '',
    });
  });
});

describe('adminApiQuery', () => {
  it('перекладає стан у параметри API', () => {
    const state = parseAdminQuery({ q: 'ivan', role: 'USER', from: '2026-02-01', sort: 'name' });
    expect(adminApiQuery(state)).toEqual({
      q: 'ivan',
      role: 'USER',
      registeredFrom: '2026-02-01',
      registeredTo: '',
      sort: 'name',
      order: 'asc',
      page: 1,
      limit: 8,
    });
  });

  it('Я-А і дата реєстрації', () => {
    expect(adminApiQuery(parseAdminQuery({ sort: '-name' }))).toMatchObject({
      sort: 'name',
      order: 'desc',
    });
    const byDate = adminApiQuery(parseAdminQuery({}));
    expect(byDate.sort).toBeUndefined();
    expect(byDate.order).toBeUndefined();
  });
});

describe('adminHref', () => {
  it('пропускає значення за замовчуванням', () => {
    expect(adminHref(parseAdminQuery({}))).toBe('/admin');
    expect(adminHref({ ...parseAdminQuery({}), q: 'ivan', page: 2, sort: 'name' })).toBe(
      '/admin?q=ivan&sort=name&page=2',
    );
  });

  it('адреса і розбір дають той самий стан', () => {
    const state = parseAdminQuery({
      q: 'олена',
      role: 'ADMIN',
      from: '2026-01-05',
      to: '2026-01-09',
      sort: '-name',
      page: '2',
    });
    const query = Object.fromEntries(new URLSearchParams(adminHref(state).split('?')[1]));
    expect(parseAdminQuery(query)).toEqual(state);
  });
});

describe('hasFilters і dateRangeLabel', () => {
  it('сортування і сторінка - не фільтри', () => {
    expect(hasFilters({ ...parseAdminQuery({}), sort: 'name', page: 3 })).toBe(false);
    expect(hasFilters(parseAdminQuery({ role: 'USER' }))).toBe(true);
  });

  it('підпис дати', () => {
    expect(dateRangeLabel({})).toBe('');
    expect(dateRangeLabel({ from: '2026-02-10', to: '2026-02-10' })).toBe('10.02.26');
    expect(dateRangeLabel({ from: '2026-02-01', to: '2026-02-10' })).toBe('01.02.26 – 10.02.26');
    expect(dateRangeLabel({ from: '2026-02-01' })).toBe('з 01.02.26');
    expect(dateRangeLabel({ to: '2026-02-10' })).toBe('до 10.02.26');
  });
});

describe('replaceUser', () => {
  it('оновлює лише користувача з відповіді API і не мутує список', () => {
    const items = [
      { id: 1, name: 'А', isActive: true },
      { id: 2, name: 'Б', isActive: true },
    ];
    expect(replaceUser(items, { id: 2, isActive: false })).toEqual([
      { id: 1, name: 'А', isActive: true },
      { id: 2, name: 'Б', isActive: false },
    ]);
    expect(items[1].isActive).toBe(true);
  });
});

describe('confirmText', () => {
  it('тексти підтвердження бану і розбану', () => {
    const user = { name: 'Валерія', username: 'valeria' };
    expect(confirmText(user, 'ban')).toMatchObject({
      title: 'Забанити користувача?',
      button: 'Забанити',
      done: 'Валерія заблоковано',
    });
    expect(confirmText(user, 'unban')).toMatchObject({
      title: 'Розблокувати користувача?',
      done: 'Валерія розблоковано',
    });
    expect(confirmText(user, 'unban').text).toContain('@valeria');
  });

  it('тексти призначення і зняття модератора', () => {
    const user = { name: 'Валерія', username: 'valeria' };
    expect(confirmText(user, 'promote')).toMatchObject({
      title: 'Призначити модератором?',
      button: 'Призначити',
      done: 'Валерія тепер модератор',
    });
    expect(confirmText(user, 'demote')).toMatchObject({
      title: 'Зняти роль модератора?',
      done: 'Валерія більше не модератор',
    });
  });
});
