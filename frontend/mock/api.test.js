import { describe, it, expect, beforeEach } from 'vitest';
import { createMockApi } from './api.js';
import { parseMultipart } from './multipart.js';

let api;

beforeEach(() => {
  api = createMockApi({ now: new Date('2026-10-14T12:00:00Z').getTime() });
});

function call(method, path, { body, user, form, query = '' } = {}) {
  return api.handle({
    method,
    path,
    query: new URLSearchParams(query),
    cookies: user ? { token: `mock-user-${user}` } : {},
    body,
    form,
    origin: 'http://localhost:5173',
  });
}

const ADMIN = 1;
const MODERATOR = 2;
const OLEKSANDR = 3;
const IVAN = 4;
const BANNED = 9;

describe('автентифікація', () => {
  it('логін з тестовими даними ставить cookie', async () => {
    const res = await call('POST', '/sessions', {
      body: { email: 'admin@example.com', password: 'password123' },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.setCookie).toMatch(/token=mock-user-1.*HttpOnly/);
  });

  it('неправильний пароль - 401', async () => {
    const res = await call('POST', '/sessions', {
      body: { email: 'admin@example.com', password: 'wrongwrong' },
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('забанений користувач не входить - 403', async () => {
    const res = await call('POST', '/sessions', {
      body: { email: 'banned_user@example.com', password: 'password123' },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USER_BANNED');
  });

  it('реєстрація створює USER, дублікат - 409, невалідне - 422', async () => {
    const ok = await call('POST', '/users', {
      body: { username: 'newuser', email: 'new@example.com', password: 'password123' },
    });
    expect(ok.status).toBe(201);
    expect(ok.body.user.role).toBe('USER');

    const dup = await call('POST', '/users', {
      body: { username: 'newuser2', email: 'new@example.com', password: 'password123' },
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.fields.email).toBeDefined();

    const bad = await call('POST', '/users', {
      body: { username: 'a', email: 'x', password: '1' },
    });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['email', 'password', 'username']);
  });

  it('GET /users/me без сесії - 401, із сесією - 200', async () => {
    expect((await call('GET', '/users/me')).status).toBe(401);
    expect((await call('GET', '/users/me', { user: IVAN })).body.user.username).toBe('ivan');
  });
});

describe('світлини', () => {
  it('стрічка вимагає входу і повертає пагінацію', async () => {
    expect((await call('GET', '/photos')).status).toBe(401);

    const res = await call('GET', '/photos', { user: IVAN, query: 'limit=5' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 12, page: 1, limit: 5, pages: 3 });
    expect(res.body.items).toHaveLength(5);
    expect(res.body.items[0].author.username).toBeDefined();
  });

  it('світлина доступна без входу за id і slug', async () => {
    const byId = await call('GET', '/photos/3');
    expect(byId.status).toBe(200);
    const bySlug = await call('GET', `/photos/${byId.body.photo.slug}`);
    expect(bySlug.body.photo.id).toBe(3);
    expect(byId.body.photo.myRating).toBeUndefined();
  });

  it('рейтинг і кількість коментарів порахована', async () => {
    const { photo } = (await call('GET', '/photos/7', { user: IVAN })).body;
    expect(photo.ratingsCount).toBe(5);
    expect(photo.averageRating).toBe(4.8);
    expect(photo.myRating).toBe(5);
    expect(photo.commentsCount).toBe(2);
  });

  it('є світлина без тегів, без оцінок і без коментарів', async () => {
    expect((await call('GET', '/photos/7')).body.photo.tags).toEqual([]);
    expect((await call('GET', '/photos/8')).body.photo.averageRating).toBeNull();
    expect((await call('GET', '/photos/11')).body.photo.commentsCount).toBe(0);
  });

  it('PUT: власник і ADMIN можуть, інші - 403', async () => {
    const own = await call('PUT', '/photos/1', { user: OLEKSANDR, body: { description: 'Нове' } });
    expect(own.status).toBe(200);
    expect(own.body.photo.description).toBe('Нове');

    expect(
      (await call('PUT', '/photos/1', { user: IVAN, body: { description: 'x' } })).status,
    ).toBe(403);
    expect(
      (await call('PUT', '/photos/1', { user: ADMIN, body: { description: 'x' } })).status,
    ).toBe(200);
  });

  it('DELETE видаляє світлину разом з коментарями', async () => {
    expect((await call('DELETE', '/photos/3', { user: IVAN })).status).toBe(403);
    expect((await call('DELETE', '/photos/3', { user: ADMIN })).status).toBe(204);
    expect((await call('GET', '/photos/3')).status).toBe(404);
    expect((await call('GET', '/photos/3/comments')).status).toBe(404);
  });

  it('створення світлини через multipart з тегами', async () => {
    const boundary = '----test';
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\nМоя світлина\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="tags"\r\n\r\nкіт, Дім\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`,
    ];
    const raw = Buffer.concat([
      Buffer.from(parts.join('')),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const form = parseMultipart(raw, `multipart/form-data; boundary=${boundary}`);
    expect(form.file.size).toBe(png.length);

    const res = await call('POST', '/photos', { user: IVAN, form });
    expect(res.status).toBe(201);
    expect(res.body.photo.tags).toEqual(['кіт', 'дім']);
    expect(res.body.photo.url).toMatch(/^data:image\/png;base64,/);
  });

  it('створення без файлу, з порожнім описом і 6 тегами - 422', async () => {
    const res = await call('POST', '/photos', {
      user: IVAN,
      form: { fields: { description: ' ', tags: 'a,b,c,d,e,f' }, file: null },
    });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['description', 'image', 'tags']);
  });
});

describe('коментарі', () => {
  it('список з пагінацією, нові першими', async () => {
    const res = await call('GET', '/photos/3/comments', { query: 'limit=5' });
    expect(res.body.total).toBe(11);
    expect(res.body.items).toHaveLength(5);
    expect(res.body.items[0].createdAt >= res.body.items[1].createdAt).toBe(true);
  });

  it('є відредагований коментар з updatedAt після createdAt', async () => {
    const res = await call('GET', '/photos/1/comments');
    const edited = res.body.items.find((c) => c.updatedAt > c.createdAt);
    expect(edited).toBeDefined();
  });

  it('створення потребує входу і непорожнього тексту', async () => {
    expect((await call('POST', '/photos/1/comments', { body: { text: 'Hi' } })).status).toBe(401);
    expect(
      (await call('POST', '/photos/1/comments', { user: IVAN, body: { text: ' ' } })).status,
    ).toBe(422);
    const ok = await call('POST', '/photos/1/comments', { user: IVAN, body: { text: 'Привіт' } });
    expect(ok.status).toBe(201);
    expect(ok.body.comment.author.username).toBe('ivan');
  });

  it('редагує лише автор і оновлює updatedAt', async () => {
    const created = await call('POST', '/photos/1/comments', { user: IVAN, body: { text: 'v1' } });
    const id = created.body.comment.id;
    expect(
      (await call('PUT', `/comments/${id}`, { user: OLEKSANDR, body: { text: 'x' } })).status,
    ).toBe(403);
    expect(
      (await call('PUT', `/comments/${id}`, { user: MODERATOR, body: { text: 'x' } })).status,
    ).toBe(403);
    const ok = await call('PUT', `/comments/${id}`, { user: IVAN, body: { text: 'v2' } });
    expect(ok.status).toBe(200);
    expect(ok.body.comment.text).toBe('v2');
  });

  it('видаляє лише модератор або адмін, автор - 403', async () => {
    const created = await call('POST', '/photos/1/comments', { user: IVAN, body: { text: 'del' } });
    const id = created.body.comment.id;
    expect((await call('DELETE', `/comments/${id}`, { user: IVAN })).status).toBe(403);
    expect((await call('DELETE', `/comments/${id}`, { user: MODERATOR })).status).toBe(204);
    expect((await call('DELETE', `/comments/${id}`, { user: MODERATOR })).status).toBe(404);
  });
});

describe('рейтинг', () => {
  it('нова оцінка перераховує середнє', async () => {
    const res = await call('POST', '/photos/8/ratings', { user: OLEKSANDR, body: { value: 4 } });
    expect(res.status).toBe(201);
    expect(res.body.averageRating).toBe(4);
    expect(res.body.ratingsCount).toBe(1);
  });

  it('повторна - 409, власна - 403, невалідна - 422', async () => {
    expect(
      (await call('POST', '/photos/7/ratings', { user: IVAN, body: { value: 3 } })).status,
    ).toBe(409);
    expect(
      (await call('POST', '/photos/1/ratings', { user: OLEKSANDR, body: { value: 3 } })).status,
    ).toBe(403);
    expect(
      (await call('POST', '/photos/8/ratings', { user: OLEKSANDR, body: { value: 6 } })).status,
    ).toBe(422);
    expect((await call('POST', '/photos/8/ratings', { body: { value: 3 } })).status).toBe(401);
  });

  it('перегляд і видалення оцінок лише для staff', async () => {
    expect((await call('GET', '/photos/7/ratings', { user: IVAN })).status).toBe(403);
    const list = await call('GET', '/photos/7/ratings', { user: MODERATOR });
    expect(list.body.total).toBe(5);
    const id = list.body.items[0].id;
    expect((await call('DELETE', `/ratings/${id}`, { user: IVAN })).status).toBe(403);
    expect((await call('DELETE', `/ratings/${id}`, { user: MODERATOR })).status).toBe(204);
  });
});

describe('посилання і QR', () => {
  it('створює посилання з QR у data URL', async () => {
    const res = await call('POST', '/photos/1/links', {
      user: OLEKSANDR,
      body: { transformations: { effect: 'sepia', angle: 90, crop: 'square' } },
    });
    expect(res.status).toBe(201);
    expect(res.body.link.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(res.body.link.url).toContain('effect=sepia');
  });

  it('невалідні трансформації - 422, чужа світлина - 403', async () => {
    const bad = await call('POST', '/photos/1/links', {
      user: OLEKSANDR,
      body: { transformations: { effect: 'neon', angle: 400 } },
    });
    expect(bad.status).toBe(422);
    const foreign = await call('POST', '/photos/1/links', {
      user: IVAN,
      body: { transformations: { effect: 'sepia' } },
    });
    expect(foreign.status).toBe(403);
  });

  it('список посилань світлини', async () => {
    const res = await call('GET', '/photos/1/links');
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].qrCode).toBeDefined();
  });
});

describe('пошук', () => {
  it('за ключовим словом і тегом', async () => {
    const q = await call('GET', '/search/photos', { user: IVAN, query: 'q=гори' });
    expect(q.body.total).toBeGreaterThan(1);
    const tag = await call('GET', '/search/photos', { user: IVAN, query: 'tag=лаванда' });
    expect(tag.body.items.map((p) => p.id)).toEqual([10]);
  });

  it('сортування і фільтр за рейтингом', async () => {
    const res = await call('GET', '/search/photos', {
      user: IVAN,
      query: 'sort=rating&order=desc&ratingMin=4.5',
    });
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((p) => p.averageRating >= 4.5)).toBe(true);
  });

  it('фільтр за користувачем лише для staff', async () => {
    expect(
      (await call('GET', '/search/photos', { user: IVAN, query: 'username=admin' })).status,
    ).toBe(403);
    const ok = await call('GET', '/search/photos', {
      user: MODERATOR,
      query: 'username=oleksandr',
    });
    expect(ok.body.items.every((p) => p.author.username === 'oleksandr')).toBe(true);
  });
});

describe('профіль і адмінка', () => {
  it('публічний профіль і галерея', async () => {
    const profile = await call('GET', '/users/oleksandr');
    expect(profile.body.user.photosCount).toBe(3);
    expect(profile.body.user.email).toBeUndefined();
    const photos = await call('GET', '/users/oleksandr/photos');
    expect(photos.body.items).toHaveLength(3);
    expect((await call('GET', '/users/nobody')).status).toBe(404);
  });

  it('новачок без світлин і без аватара', async () => {
    const profile = await call('GET', '/users/newbie');
    expect(profile.body.user.photosCount).toBe(0);
    expect(profile.body.user.avatarUrl).toBeNull();
  });

  it('список користувачів лише для staff, з фільтрами', async () => {
    expect((await call('GET', '/admin/users', { user: IVAN })).status).toBe(403);
    const all = await call('GET', '/admin/users', { user: MODERATOR });
    expect(all.body.total).toBe(10);
    const filtered = await call('GET', '/admin/users', {
      user: MODERATOR,
      query: 'role=MODERATOR',
    });
    expect(filtered.body.items).toHaveLength(1);
  });

  it('бан і розбан лише для ADMIN, адміна банити не можна', async () => {
    expect(
      (await call('PATCH', '/admin/users/3/status', { user: MODERATOR, body: { isActive: false } }))
        .status,
    ).toBe(403);
    const ban = await call('PATCH', '/admin/users/3/status', {
      user: ADMIN,
      body: { isActive: false },
    });
    expect(ban.body.user.isActive).toBe(false);
    expect((await call('GET', '/users/me', { user: OLEKSANDR })).status).toBe(403);
    const unban = await call('PATCH', '/admin/users/9/status', {
      user: ADMIN,
      body: { isActive: true },
    });
    expect(unban.body.user.isActive).toBe(true);
    expect(
      (await call('PATCH', '/admin/users/1/status', { user: ADMIN, body: { isActive: false } }))
        .status,
    ).toBe(403);
  });

  it('забанений користувач не має доступу до API', async () => {
    expect((await call('GET', '/photos', { user: BANNED })).status).toBe(403);
  });
});

describe('службові', () => {
  it('fail-next ламає наступний запит один раз', async () => {
    await call('POST', '/dev/fail-next', { body: { status: 500 } });
    expect((await call('GET', '/health')).status).toBe(500);
    expect((await call('GET', '/health')).status).toBe(200);
  });

  it('reset повертає початкові дані', async () => {
    await call('DELETE', '/photos/1', { user: ADMIN });
    await call('POST', '/dev/reset');
    expect((await call('GET', '/photos/1')).status).toBe(200);
  });

  it('невідомий маршрут - 404, невідомий метод - 405', async () => {
    expect((await call('GET', '/nothing')).status).toBe(404);
    expect((await call('PATCH', '/photos')).status).toBe(405);
  });
});
