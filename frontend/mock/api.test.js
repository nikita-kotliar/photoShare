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

describe('вхід через Google', () => {
  it('повертає на /home з сесією акаунта, пов’язаного з Google', async () => {
    const res = await call('GET', '/auth/google');
    expect(res.status).toBe(302);
    expect(res.redirect).toBe('http://localhost:5173/home');
    const userId = Number(res.setCookie.match(/token=mock-user-(\d+)/)[1]);
    const me = await call('GET', '/users/me', { user: userId });
    expect(me.body.user).toMatchObject({ username: 'newbie', googleLinked: true });
  });

  it('помилка повертає на /auth з кодом', async () => {
    const res = await call('GET', '/auth/google', { query: 'mockError=cancelled' });
    expect(res.redirect).toBe('http://localhost:5173/auth?googleError=cancelled');

    await call('POST', '/dev/fail-next', { body: { status: 503 } });
    const failed = await call('GET', '/auth/google');
    expect(failed.redirect).toBe('http://localhost:5173/auth?googleError=unavailable');
    expect(failed.setCookie).toBeUndefined();
  });

  it('звичайні акаунти не пов’язані з Google', async () => {
    const me = await call('GET', '/users/me', { user: ADMIN });
    expect(me.body.user.googleLinked).toBe(false);
  });
});

describe('досягнення', () => {
  it('у авторів світлин є «Перша світлина», решта не отримані', async () => {
    const res = await call('GET', '/users/oleksandr/achievements');
    expect(res.body.items.map((a) => [a.code, a.earned])).toEqual([
      ['FIRST_PHOTO', true],
      ['TEN_PHOTOS', false],
      ['COMMENTATOR', false],
      ['CRITIC', false],
      ['FAVORITE', false],
    ]);
    expect((await call('GET', '/users/nobody/achievements')).status).toBe(404);
  });

  it('перша публікація повертає newAchievements і сповіщення', async () => {
    const form = {
      fields: { description: 'Перша' },
      file: { type: 'image/png', size: 10, data: Buffer.from('png') },
    };
    const res = await call('POST', '/photos', { user: 10, form });
    expect(res.body.newAchievements).toEqual(['FIRST_PHOTO']);
    const again = await call('POST', '/photos', { user: 10, form });
    expect(again.body.newAchievements).toEqual([]);
    const [notice] = (await call('GET', '/notifications', { user: 10 })).body.items;
    expect(notice).toMatchObject({ type: 'ACHIEVEMENT', data: { code: 'FIRST_PHOTO' } });
  });

  it('коментар і оцінка повертають newAchievements', async () => {
    const photo = (await call('GET', '/users/oleksandr/photos')).body.items[0];
    const comment = await call('POST', `/photos/${photo.id}/comments`, {
      user: 10,
      body: { text: 'Гарно' },
    });
    expect(comment.body.newAchievements).toEqual([]);
  });
});

describe('сповіщення', () => {
  it('у oleksandr є стартові сповіщення, 3 непрочитані', async () => {
    const list = await call('GET', '/notifications', { user: OLEKSANDR });
    expect(list.body.total).toBe(4);
    expect(list.body.items[0]).toMatchObject({ type: 'ACHIEVEMENT', actor: null, read: false });
    const count = await call('GET', '/notifications/unread-count', { user: OLEKSANDR });
    expect(count.body.count).toBe(3);
  });

  it('коментар і оцінка чужої світлини сповіщають автора, власні дії - ні', async () => {
    const NEWBIE = 10; // ще нічого не оцінював
    const photos = (await call('GET', '/users/oleksandr/photos')).body.items;
    const before = (await call('GET', '/notifications/unread-count', { user: OLEKSANDR })).body
      .count;
    await call('POST', `/photos/${photos[0].id}/comments`, {
      user: NEWBIE,
      body: { text: 'Клас' },
    });
    await call('POST', `/photos/${photos[0].id}/ratings`, { user: NEWBIE, body: { value: 5 } });
    await call('POST', `/photos/${photos[0].id}/comments`, {
      user: OLEKSANDR,
      body: { text: 'Дякую' },
    });
    const after = (await call('GET', '/notifications/unread-count', { user: OLEKSANDR })).body
      .count;
    // коментар, оцінка і «Улюбленець» (10 оцінок світлин oleksandr, середнє вище 4.5)
    expect(after - before).toBe(3);
    const [achievement, rating] = (await call('GET', '/notifications', { user: OLEKSANDR })).body
      .items;
    expect(achievement).toMatchObject({ type: 'ACHIEVEMENT', data: { code: 'FAVORITE' } });
    expect(rating).toMatchObject({ type: 'RATING', data: { value: 5 }, actor: { id: NEWBIE } });
  });

  it('позначає прочитаними вибрані і всі', async () => {
    const one = await call('POST', '/notifications/read', { user: OLEKSANDR, body: { ids: [2] } });
    expect(one.body).toEqual({ updated: 1, unread: 2 });
    const all = await call('POST', '/notifications/read', { user: OLEKSANDR, body: {} });
    expect(all.body.unread).toBe(0);
    expect(
      (await call('POST', '/notifications/read', { user: OLEKSANDR, body: { ids: [] } })).status,
    ).toBe(422);
  });

  it('без входу 401', async () => {
    expect((await call('GET', '/notifications')).status).toBe(401);
  });
});

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

  it('повторна змінює оцінку (200), власна - 403, невалідна - 422', async () => {
    const again = await call('POST', '/photos/7/ratings', { user: IVAN, body: { value: 3 } });
    expect(again.status).toBe(200);
    expect(again.body.rating.value).toBe(3);
    expect((await call('GET', '/photos/7', { user: IVAN })).body.photo.myRating).toBe(3);
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

  it('сортує користувачів за іменем і датою, як бекенд', async () => {
    const list = async (query) =>
      (await call('GET', '/admin/users', { user: ADMIN, query: `limit=50&${query}` })).body.items;
    const az = (await list('sort=name')).map((u) => u.name);
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b, 'uk')));
    expect((await list('sort=name&order=desc')).map((u) => u.name)).toEqual([...az].reverse());
    const dates = (await list('order=asc')).map((u) => u.createdAt);
    expect(dates).toEqual([...dates].sort());
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

describe('світлина тижня', () => {
  it('найвищий рейтинг серед світлин від двох оцінок', async () => {
    const res = await call('GET', '/photos/featured');
    expect(res.status).toBe(200);
    expect(res.body.photo.ratingsCount).toBeGreaterThanOrEqual(2);
    const all = await call('GET', '/photos', { user: ADMIN, query: 'limit=50' });
    const top = Math.max(
      ...all.body.items.filter((p) => p.ratingsCount >= 2).map((p) => p.averageRating),
    );
    expect(res.body.photo.averageRating).toBe(top);
  });
});

describe('палітра в моку', () => {
  it('світлина має кольори з групами, пошук за кольором фільтрує', async () => {
    const photo = (await call('GET', '/photos/1')).body.photo;
    expect(photo.colors[0]).toEqual({ hex: '#ffe2a8', family: expect.any(String) });
    const purple = await call('GET', '/search/photos', { user: IVAN, query: 'color=purple' });
    expect(purple.body.items.length).toBeGreaterThan(0);
    for (const item of purple.body.items) {
      expect(item.colors.some((c) => c.family === 'purple')).toBe(true);
    }
  });
});

describe('поточна сесія', () => {
  it('гостю user null зі статусом 200, з сесією - користувач', async () => {
    expect(await call('GET', '/sessions')).toMatchObject({ status: 200, body: { user: null } });
    expect((await call('GET', '/sessions', { user: IVAN })).body.user.id).toBe(IVAN);
    expect((await call('GET', '/sessions', { user: BANNED })).body.user).toBeNull();
  });
});

describe('відновлення пароля в моку', () => {
  it('лист, новий пароль за токеном, вхід з ним; токен одноразовий', async () => {
    expect(
      (await call('POST', '/password/forgot', { body: { email: 'ivan@example.com' } })).status,
    ).toBe(200);
    const token = 'a'.repeat(64);
    const res = await call('POST', '/password/reset', {
      body: { token, password: 'new-pass-123' },
    });
    expect(res.body.user.id).toBe(IVAN);
    const login = await call('POST', '/sessions', {
      body: { email: 'ivan@example.com', password: 'new-pass-123' },
    });
    expect(login.status).toBe(200);
    expect(
      (await call('POST', '/password/reset', { body: { token, password: 'other-pass-1' } })).status,
    ).toBe(422);
  });
});
