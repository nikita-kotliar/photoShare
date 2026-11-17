// Пошук на справжньому PostgreSQL: SQL з searchService виконується так, як на проді.
// Запуск: TEST_DATABASE_URL=postgresql://... npm test (у CI це окремий сервіс postgres).
// Файл очищає всі таблиці, тому TEST_DATABASE_URL - лише окрема тестова база.

const db = require('../src/config/db');
const tagsService = require('../src/services/tagsService');
const { roundAverage } = require('../src/services/ratingsService');
const { agent, register } = require('./helpers/app');

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

// Набір світлин. ratings - оцінки від різних користувачів
const PHOTOS = [
  {
    key: 'sunset',
    author: 'alice',
    description: 'Захід сонця над морем',
    tags: ['sea', 'sunset'],
    createdAt: '2026-03-01T10:00:00Z',
    ratings: [5, 5],
  },
  {
    key: 'mountains',
    author: 'alice',
    description: 'Гори взимку',
    tags: ['mountains', 'sea'],
    createdAt: '2026-03-05T00:00:00Z',
    ratings: [3, 4, 4, 4], // 3.75, у відповіді 3.8
  },
  {
    key: 'port',
    author: 'bob',
    description: 'Морський порт',
    tags: ['port'],
    createdAt: '2026-03-10T23:59:59Z',
    ratings: [5],
  },
  {
    key: 'cat',
    author: 'bob',
    description: 'Кіт на дивані',
    tags: ['seaside', 'cat'],
    createdAt: '2026-03-11T00:00:00Z',
    ratings: [],
  },
  {
    key: 'nature',
    author: 'bob',
    description: '100% натуральне фото',
    tags: ['nature'],
    createdAt: '2026-03-20T12:00:00Z',
    ratings: [2],
  },
  {
    key: 'city',
    author: 'alice',
    description: 'Нічне місто',
    tags: ['city', 'море'],
    createdAt: '2026-04-02T08:00:00Z',
    ratings: [4, 5],
  },
];

// Значення кожного фільтра для перебору комбінацій
const FILTERS = {
  q: 'мор',
  tag: 'sea',
  ratingMin: 3.8,
  dateFrom: '2026-03-05',
  dateTo: '2026-03-10',
  username: 'alice',
};

let admin;
let user;
const ids = {};

async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE users, photos, tags, photo_tags, comments, transformed_links, ratings, token_blacklist RESTART IDENTITY CASCADE',
  );
}

async function seed() {
  // Перший зареєстрований - ADMIN
  admin = agent();
  await register(admin, { username: 'admin', email: 'admin@example.com' });
  user = agent();
  await register(user, { username: 'viewer', email: 'viewer@example.com' });

  const authors = {};
  for (const username of ['alice', 'bob']) {
    authors[username] = await db.user.create({
      data: { username, email: `${username}@example.com`, name: username, passwordHash: '-' },
    });
  }
  const voters = [];
  for (let i = 1; i <= 4; i += 1) {
    voters.push(
      await db.user.create({
        data: {
          username: `voter${i}`,
          email: `voter${i}@example.com`,
          name: 'v',
          passwordHash: '-',
        },
      }),
    );
  }

  for (const [index, item] of PHOTOS.entries()) {
    const tags = await tagsService.findOrCreate(item.tags);
    const photo = await db.photo.create({
      data: {
        slug: `slug${index}`,
        url: `https://example.com/${index}.png`,
        publicId: `photoshare/${index}`,
        description: item.description,
        authorId: authors[item.author].id,
        createdAt: new Date(item.createdAt),
        tags: tagsService.nestedCreate(tags),
      },
    });
    ids[item.key] = photo.id;
    for (const [i, value] of item.ratings.entries()) {
      await db.rating.create({ data: { photoId: photo.id, userId: voters[i].id, value } });
    }
  }
}

// Еталон: те саме, що мав би повернути пошук, порахований у JS за docs/API.md
function average(item) {
  return item.ratings.length
    ? roundAverage(item.ratings.reduce((sum, v) => sum + v, 0) / item.ratings.length)
    : null;
}

function expected(filters, { sort = 'date', order = 'desc' } = {}) {
  const q = filters.q?.toLowerCase();
  const day = (item) => item.createdAt.slice(0, 10);
  const list = PHOTOS.filter(
    (item) =>
      (!q || item.description.toLowerCase().includes(q) || item.tags.some((t) => t.includes(q))) &&
      (!filters.tag || item.tags.includes(filters.tag)) &&
      (filters.ratingMin === undefined || (average(item) ?? 0) >= filters.ratingMin) &&
      (!filters.dateFrom || day(item) >= filters.dateFrom) &&
      (!filters.dateTo || day(item) <= filters.dateTo) &&
      (!filters.username || item.author === filters.username),
  );

  const dir = order === 'asc' ? 1 : -1;
  const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);
  const byDate = (a, b) => -newestFirst(a, b) * dir;
  // Без оцінок в кінці; рівне середнє: більше оцінок вище, далі новіші
  const byRating = (a, b) => {
    const [x, y] = [average(a), average(b)];
    if (x === null || y === null) return (x === null) - (y === null);
    return (x - y) * dir || b.ratings.length - a.ratings.length || newestFirst(a, b);
  };
  return list.sort(sort === 'rating' ? byRating : byDate).map((item) => ids[item.key]);
}

function search(client, params) {
  const query = new URLSearchParams({ limit: 50, ...params });
  return client.get(`/api/search/photos?${query}`);
}

function subsets(keys) {
  return keys.reduce((all, key) => [...all, ...all.map((set) => [...set, key])], [[]]);
}

describeDb('GET /api/search/photos на PostgreSQL', () => {
  beforeAll(async () => {
    await resetDb();
    await seed();
  });

  afterAll(async () => {
    await resetDb();
    await db.$disconnect();
  });

  // 64 комбінації фільтрів x 2 сортування, кожна звіряється з еталоном
  const combos = subsets(Object.keys(FILTERS));
  it.each(combos.map((keys) => [keys.join(' + ') || 'без фільтрів', keys]))(
    '%s',
    async (_name, keys) => {
      const filters = Object.fromEntries(keys.map((key) => [key, FILTERS[key]]));
      for (const sort of ['date', 'rating']) {
        const res = await search(admin, { ...filters, sort });
        expect(res.status).toBe(200);
        expect(res.body.items.map((photo) => photo.id)).toEqual(expected(filters, { sort }));
        expect(res.body.total).toBe(res.body.items.length);
      }
    },
  );

  it('q шукає без урахування регістру в описі і частково в тегах', async () => {
    const res = await search(user, { q: 'МОР' });
    expect(res.body.items.map((p) => p.id)).toEqual([ids.city, ids.port, ids.sunset]);

    const byTag = await search(user, { q: 'side' });
    expect(byTag.body.items.map((p) => p.id)).toEqual([ids.cat]);
  });

  it('% і _ у запиті шукаються як звичайні символи', async () => {
    expect((await search(user, { q: '%' })).body.items.map((p) => p.id)).toEqual([ids.nature]);
    expect((await search(user, { q: '_' })).body.total).toBe(0);
  });

  it('tag - точний збіг без урахування регістру, а не частина тега', async () => {
    const res = await search(user, { tag: ' SEA ' });
    expect(res.body.items.map((p) => p.id)).toEqual([ids.mountains, ids.sunset]);
  });

  it('dateFrom і dateTo включають обидва дні за UTC', async () => {
    const res = await search(user, { dateFrom: '2026-03-10', dateTo: '2026-03-10' });
    expect(res.body.items.map((p) => p.id)).toEqual([ids.port]);
  });

  it('ratingMin порівнює з округленим середнім, яке бачить користувач', async () => {
    const res = await search(user, { ratingMin: 3.8, sort: 'rating' });
    expect(res.body.items.map((p) => p.id)).toEqual([
      ids.sunset,
      ids.port,
      ids.city,
      ids.mountains,
    ]);
    expect(res.body.items.at(-1).averageRating).toBe(3.8);
  });

  it('sort=rating: без оцінок в кінці і за зростанням, при рівному середньому більше оцінок вище', async () => {
    const desc = await search(user, { sort: 'rating' });
    expect(desc.body.items.map((p) => p.id)).toEqual([
      ids.sunset,
      ids.port,
      ids.city,
      ids.mountains,
      ids.nature,
      ids.cat,
    ]);

    const asc = await search(user, { sort: 'rating', order: 'asc' });
    expect(asc.body.items.map((p) => p.id)).toEqual([
      ids.nature,
      ids.mountains,
      ids.city,
      ids.sunset,
      ids.port,
      ids.cat,
    ]);
  });

  it('sort=date order=asc: старіші першими', async () => {
    const res = await search(user, { order: 'asc' });
    expect(res.body.items.map((p) => p.id)).toEqual(PHOTOS.map((item) => ids[item.key]));
  });

  it('пагінація: сторінка з потрібними світлинами і загальна кількість', async () => {
    const res = await search(user, { sort: 'rating', limit: 2, page: 2 });
    expect(res.body).toMatchObject({ total: 6, page: 2, limit: 2, pages: 3 });
    expect(res.body.items.map((p) => p.id)).toEqual([ids.city, ids.mountains]);
  });

  it('світлини у форматі стрічки: теги, автор, рейтинг', async () => {
    const res = await search(user, { tag: 'port' });
    expect(res.body.items).toEqual([
      expect.objectContaining({
        id: ids.port,
        description: 'Морський порт',
        tags: ['port'],
        author: expect.objectContaining({ username: 'bob' }),
        averageRating: 5,
        ratingsCount: 1,
        myRating: null,
      }),
    ]);
  });

  it('невідомий автор: порожній результат, USER з username: 403', async () => {
    expect((await search(admin, { username: 'nobody' })).body.total).toBe(0);
    expect((await search(user, { username: 'alice' })).status).toBe(403);
  });
});
