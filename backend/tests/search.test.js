jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const fakeDb = require('./helpers/fakeDb');
const { agent } = require('./helpers/app');
const { allRoles, upload } = require('./helpers/fixtures');
const { buildQueries, likePattern } = require('../src/services/searchService');

// Валідація, права і складання SQL. Як працюють самі фільтри на PostgreSQL - search.db.test.js

beforeEach(() => {
  fakeDb.reset();
  jest.restoreAllMocks();
});

const defaults = { page: 1, limit: 12, sort: 'date', order: 'desc' };

function sqlOf(query) {
  const { page, count } = buildQueries({ ...defaults, ...query });
  const text = (sql) => sql.text.replace(/\s+/g, ' ');
  return { page: text(page), count: text(count), values: page.values };
}

// Відповідь SQL: id світлин сторінки, потім кількість
function stubSql(ids, total = ids.length) {
  return jest
    .spyOn(fakeDb, '$queryRaw')
    .mockResolvedValueOnce(ids.map((id) => ({ id })))
    .mockResolvedValueOnce([{ total }]);
}

describe('GET /api/search/photos: доступ і валідація', () => {
  it('без входу 401', async () => {
    const res = await agent().get('/api/search/photos?q=море');
    expect(res.status).toBe(401);
  });

  it.each([
    ['sort=popular', 'sort'],
    ['order=up', 'order'],
    ['ratingMin=0', 'ratingMin'],
    ['ratingMin=6', 'ratingMin'],
    ['ratingMin=abc', 'ratingMin'],
    ['dateFrom=01.03.2026', 'dateFrom'],
    ['dateTo=2026-02-30', 'dateTo'],
    ['dateFrom=2026-03-10&dateTo=2026-03-01', 'dateTo'],
    [`q=${'a'.repeat(101)}`, 'q'],
    [`tag=${'a'.repeat(31)}`, 'tag'],
    ['limit=51', 'limit'],
    ['page=0', 'page'],
  ])('%s: 422 з помилкою в полі %s', async (query, field) => {
    const { stranger } = await allRoles();
    const res = await stranger.client.get(`/api/search/photos?${query}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty(field);
  });

  it('звичайний користувач не може фільтрувати за автором: 403', async () => {
    const { stranger } = await allRoles();
    const spy = jest.spyOn(fakeDb, '$queryRaw');
    const res = await stranger.client.get('/api/search/photos?username=owner');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(spy).not.toHaveBeenCalled();
  });

  it.each(['moderator', 'admin'])('%s може фільтрувати за автором', async (role) => {
    const people = await allRoles();
    stubSql([]);
    const res = await people[role].client.get('/api/search/photos?username=owner');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, page: 1, limit: 12, pages: 0 });
  });

  it('порожні параметри вважаються невказаними', async () => {
    const { stranger } = await allRoles();
    const spy = stubSql([]);
    const res = await stranger.client.get(
      '/api/search/photos?q=&tag=&sort=&order=&ratingMin=&dateFrom=&dateTo=',
    );

    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][0].values).toEqual([12, 0]);
  });
});

describe('GET /api/search/photos: відповідь', () => {
  it('світлини йдуть у порядку з SQL, з рейтингом і пагінацією', async () => {
    const { owner, stranger } = await allRoles();
    const first = (await upload(owner.client, 'Перша')).body.photo;
    const second = (await upload(owner.client, 'Друга')).body.photo;
    await stranger.client.post(`/api/photos/${first.id}/ratings`).send({ value: 4 });
    stubSql([first.id, second.id], 7);

    const res = await stranger.client.get('/api/search/photos?sort=rating&limit=2');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 7, page: 1, limit: 2, pages: 4 });
    expect(res.body.items.map((photo) => photo.id)).toEqual([first.id, second.id]);
    expect(res.body.items[0]).toMatchObject({
      description: 'Перша',
      averageRating: 4,
      ratingsCount: 1,
      myRating: 4,
    });
    expect(res.body.items[1]).toMatchObject({ averageRating: null, myRating: null });
  });
});

describe('searchService: SQL', () => {
  it('без фільтрів: без WHERE і без агрегату оцінок, нові першими', () => {
    const { page, count, values } = sqlOf({});
    expect(page).not.toContain('WHERE');
    expect(page).not.toContain('ratings');
    expect(page).toContain('ORDER BY p.created_at DESC, p.id DESC');
    expect(count).not.toContain('ratings');
    expect(values).toEqual([12, 0]);
  });

  it('значення фільтрів передаються параметрами, а не вставляються в SQL', () => {
    const query = {
      q: "'; DROP TABLE photos; --",
      tag: 'sea',
      ratingMin: 3.5,
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
      username: 'alice',
      page: 3,
      limit: 5,
    };
    const { page, count, values } = sqlOf(query);

    expect(page).not.toContain('DROP');
    expect(count).not.toContain('DROP');
    expect(values).toEqual([
      "%'; DROP TABLE photos; --%",
      "%'; DROP TABLE photos; --%",
      'sea',
      '2026-03-01',
      '2026-03-31',
      'alice',
      3.5,
      5,
      10,
    ]);
  });

  it('ratingMin додає агрегат оцінок і в запит сторінки, і в кількість', () => {
    const { page, count } = sqlOf({ ratingMin: 4 });
    expect(page).toContain('ROUND(AVG(value)::numeric, 1)');
    expect(page).toContain('r.avg >= $1');
    expect(count).toContain('r.avg >= $1');
  });

  it('sort=rating: агрегат лише в запиті сторінки, без оцінок в кінці', () => {
    const { page, count } = sqlOf({ sort: 'rating', order: 'asc' });
    expect(page).toContain('ORDER BY r.avg ASC NULLS LAST, r.cnt DESC NULLS LAST');
    expect(count).not.toContain('ratings');
  });

  it('напрямок сортування лише ASC або DESC', () => {
    expect(sqlOf({ order: 'asc' }).page).toContain('p.created_at ASC, p.id ASC');
    expect(sqlOf({ order: 'desc; DROP TABLE photos' }).page).toContain('p.created_at DESC');
  });

  it('likePattern екранує символи шаблону ILIKE', () => {
    expect(likePattern('100%')).toBe('%100\\%%');
    expect(likePattern('a_b')).toBe('%a\\_b%');
    expect(likePattern('c:\\dir')).toBe('%c:\\\\dir%');
  });
});
