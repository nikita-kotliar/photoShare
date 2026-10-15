import { describe, it, expect } from 'vitest';
import { matchRoute, parseQuery, resolveAccess } from './match.js';

const routes = [
  { path: '/', access: 'guest' },
  { path: '/photos/:id', access: 'private' },
  { path: '/users/:username', access: 'any' },
  { path: '/admin', access: 'private', roles: ['ADMIN', 'MODERATOR'] },
  { path: '*', access: 'any', name: 'notfound' },
];

describe('matchRoute', () => {
  it('знаходить статичний маршрут', () => {
    expect(matchRoute(routes, '/').route.path).toBe('/');
  });

  it('витягує параметри', () => {
    const match = matchRoute(routes, '/photos/42');
    expect(match.route.path).toBe('/photos/:id');
    expect(match.params).toEqual({ id: '42' });
  });

  it('декодує параметри', () => {
    expect(matchRoute(routes, '/users/ivan%20k').params.username).toBe('ivan k');
  });

  it('ігнорує кінцевий слеш', () => {
    expect(matchRoute(routes, '/admin/').route.path).toBe('/admin');
  });

  it('невідомий шлях веде на 404', () => {
    expect(matchRoute(routes, '/nope/nope').route.name).toBe('notfound');
  });

  it('не збігається з довшим шляхом', () => {
    expect(matchRoute(routes, '/photos/1/extra').route.name).toBe('notfound');
  });
});

describe('parseQuery', () => {
  it('розбирає query-рядок', () => {
    expect(parseQuery('?q=cat&page=2')).toEqual({ q: 'cat', page: '2' });
  });
});

describe('resolveAccess', () => {
  const user = { id: 1, role: 'USER' };
  const admin = { id: 2, role: 'ADMIN' };

  it('guest-маршрут перенаправляє авторизованого на /home', () => {
    expect(resolveAccess(routes[0], user)).toEqual({ redirect: '/home' });
    expect(resolveAccess(routes[0], null)).toEqual({ allowed: true });
  });

  it('private-маршрут перенаправляє гостя на /auth', () => {
    expect(resolveAccess(routes[1], null)).toEqual({ redirect: '/auth' });
    expect(resolveAccess(routes[1], user)).toEqual({ allowed: true });
  });

  it('any-маршрут відкритий для всіх', () => {
    expect(resolveAccess(routes[2], null)).toEqual({ allowed: true });
  });

  it('маршрут з ролями пускає лише потрібні ролі', () => {
    expect(resolveAccess(routes[3], user)).toEqual({ redirect: '/home' });
    expect(resolveAccess(routes[3], admin)).toEqual({ allowed: true });
    expect(resolveAccess(routes[3], null)).toEqual({ redirect: '/auth' });
  });
});
