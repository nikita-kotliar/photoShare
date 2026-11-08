jest.mock('../src/config/db', () => require('./helpers/fakeDb'));
jest.mock('../src/services/cloudinaryService', () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
  transformedUrl: jest.fn(),
}));

const fakeDb = require('./helpers/fakeDb');
const cloudinaryService = require('../src/services/cloudinaryService');
const { agent } = require('./helpers/app');
const { PNG, mockCloudinary, team } = require('./helpers/fixtures');
const { normalizeTags, tagsSchema } = require('../src/validators/tags');

beforeEach(() => {
  fakeDb.reset();
  jest.clearAllMocks();
  mockCloudinary(cloudinaryService);
});

function uploadWith(client, fields = {}, description = 'Захід сонця') {
  let req = client.post('/api/photos').field('description', description);
  for (const [name, value] of Object.entries(fields)) {
    for (const item of [].concat(value)) req = req.field(name, item);
  }
  return req.attach('image', PNG, 'photo.png');
}

describe('normalizeTags / tagsSchema', () => {
  it('trim, нижній регістр, без порожніх і дублікатів, порядок першої появи', () => {
    expect(normalizeTags(['Море', ' море ', '', '   ', 'Небо', 'небо', 'ГОРИ'])).toEqual([
      'море',
      'небо',
      'гори',
    ]);
  });

  it('приймає масив, JSON-рядок і рядок через кому', () => {
    expect(tagsSchema.parse(['Кіт', 'Дім'])).toEqual(['кіт', 'дім']);
    expect(tagsSchema.parse('["Кіт","Дім"]')).toEqual(['кіт', 'дім']);
    expect(tagsSchema.parse('Кіт, Дім ,')).toEqual(['кіт', 'дім']);
  });

  it('порожнє значення дає [], відсутнє лишається undefined', () => {
    expect(tagsSchema.parse('')).toEqual([]);
    expect(tagsSchema.parse(null)).toEqual([]);
    expect(tagsSchema.parse(undefined)).toBe(undefined);
  });

  it('відхиляє шостий тег, задовгий тег і нетекстові значення', () => {
    expect(tagsSchema.safeParse('a,b,c,d,e,f').success).toBe(false);
    expect(tagsSchema.safeParse(['a'.repeat(31)]).success).toBe(false);
    expect(tagsSchema.safeParse([{ name: 'a' }]).success).toBe(false);
    expect(tagsSchema.safeParse(42).success).toBe(false);
  });

  it('дублікати й порожні не рахуються в ліміті 5', () => {
    expect(tagsSchema.safeParse(['a', 'A', ' a ', '', 'b', 'c', 'd', 'e']).success).toBe(true);
  });
});

describe('POST /api/photos з тегами', () => {
  it('теги необов’язкові: без поля tags повертається []', async () => {
    const { owner } = await team();
    const res = await uploadWith(owner.client);

    expect(res.status).toBe(201);
    expect(res.body.photo.tags).toEqual([]);
    expect(fakeDb.tagNames()).toEqual([]);
  });

  it('нормалізує теги: нижній регістр, trim, без дублікатів', async () => {
    const { owner } = await team();
    const res = await uploadWith(owner.client, { tags: 'Море, ПРИРОДА, море, ' });

    expect(res.status).toBe(201);
    expect(res.body.photo.tags).toEqual(['море', 'природа']);
    expect(fakeDb.tagNames().sort()).toEqual(['море', 'природа']);
  });

  it('приймає JSON-масив і повторювані поля tags', async () => {
    const { owner } = await team();
    const json = await uploadWith(owner.client, { tags: '["Кіт","Дім"]' });
    const repeated = await uploadWith(owner.client, { tags: ['Ліс', 'Річка'] });

    expect(json.body.photo.tags).toEqual(['дім', 'кіт']);
    expect(repeated.body.photo.tags).toEqual(['ліс', 'річка']);
  });

  it('п’ять тегів можна, шостий дає 422 і файл не вантажиться', async () => {
    const { owner } = await team();
    const ok = await uploadWith(owner.client, { tags: 'a,b,c,d,e' });
    expect(ok.status).toBe(201);
    expect(ok.body.photo.tags).toHaveLength(5);

    cloudinaryService.uploadImage.mockClear();
    const res = await uploadWith(owner.client, { tags: 'a,b,c,d,e,f' });

    expect(res.status).toBe(422);
    expect(res.body.error.fields.tags).toBe('Можна додати не більше 5 тегів');
    expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
  });

  it('тег довший за 30 символів дає 422', async () => {
    const { owner } = await team();
    const res = await uploadWith(owner.client, { tags: 'a'.repeat(31) });

    expect(res.status).toBe(422);
    expect(res.body.error.fields.tags).toBe('Тег не може бути довшим за 30 символів');
  });

  it('тег спільний для всіх світлин: у БД лише один запис', async () => {
    const { owner, stranger } = await team();
    const first = await uploadWith(owner.client, { tags: 'море, небо' });
    const second = await uploadWith(stranger.client, { tags: 'Море' });

    expect(first.body.photo.tags).toEqual(['море', 'небо']);
    expect(second.body.photo.tags).toEqual(['море']);
    expect(fakeDb.tagNames().sort()).toEqual(['море', 'небо']);
  });

  it('одночасні запити з тим самим новим тегом не створюють дублікатів', async () => {
    const { owner, stranger } = await team();
    const responses = await Promise.all([
      uploadWith(owner.client, { tags: 'новий' }),
      uploadWith(stranger.client, { tags: 'новий' }),
    ]);

    expect(responses.map((res) => res.status)).toEqual([201, 201]);
    expect(fakeDb.tagNames()).toEqual(['новий']);
  });
});

describe('теги у відповідях', () => {
  it('GET по id, по slug і стрічка повертають теги', async () => {
    const { owner } = await team();
    const { photo } = (await uploadWith(owner.client, { tags: 'море, небо' })).body;

    const byId = await agent().get(`/api/photos/${photo.id}`);
    const bySlug = await agent().get(`/api/photos/${photo.slug}`);
    const feed = await owner.client.get('/api/photos');

    expect(byId.body.photo.tags).toEqual(['море', 'небо']);
    expect(bySlug.body.photo.tags).toEqual(['море', 'небо']);
    expect(feed.body.items[0].tags).toEqual(['море', 'небо']);
  });

  it('видалення світлини прибирає зв’язки, а теги лишаються для повторного використання', async () => {
    const { owner } = await team();
    const { photo } = (await uploadWith(owner.client, { tags: 'море' })).body;

    await owner.client.delete(`/api/photos/${photo.id}`);
    const again = await uploadWith(owner.client, { tags: 'море' });

    expect(again.body.photo.tags).toEqual(['море']);
    expect(fakeDb.tagNames()).toEqual(['море']);
  });
});

describe('PUT /api/photos/:id з тегами', () => {
  async function setup() {
    const people = await team();
    const { photo } = (await uploadWith(people.owner.client, { tags: 'море, небо' })).body;
    return { ...people, photo };
  }

  it('без tags теги не змінюються', async () => {
    const { owner, photo } = await setup();
    const res = await owner.client.put(`/api/photos/${photo.id}`).send({ description: 'Новий опис' });

    expect(res.status).toBe(200);
    expect(res.body.photo.description).toBe('Новий опис');
    expect(res.body.photo.tags).toEqual(['море', 'небо']);
  });

  it('tags замінює набір: старі прибираються, нові додаються', async () => {
    const { owner, photo } = await setup();
    const res = await owner.client
      .put(`/api/photos/${photo.id}`)
      .send({ description: 'Опис', tags: ['Небо', 'Гори', 'гори'] });

    expect(res.status).toBe(200);
    expect(res.body.photo.tags).toEqual(['гори', 'небо']);
    expect(fakeDb.tagNames().sort()).toEqual(['гори', 'море', 'небо']);
  });

  it('порожній масив прибирає всі теги', async () => {
    const { owner, photo } = await setup();
    const res = await owner.client.put(`/api/photos/${photo.id}`).send({ description: 'Опис', tags: [] });

    expect(res.status).toBe(200);
    expect(res.body.photo.tags).toEqual([]);
  });

  it('шостий тег дає 422 і старі теги лишаються', async () => {
    const { owner, photo } = await setup();
    const res = await owner.client
      .put(`/api/photos/${photo.id}`)
      .send({ description: 'Опис', tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
    const after = await agent().get(`/api/photos/${photo.id}`);

    expect(res.status).toBe(422);
    expect(res.body.error.fields.tags).toBeDefined();
    expect(after.body.photo.tags).toEqual(['море', 'небо']);
  });

  it('чужу світлину змінити не можна, теги теж', async () => {
    const { stranger, photo } = await setup();
    const res = await stranger.client
      .put(`/api/photos/${photo.id}`)
      .send({ description: 'Опис', tags: ['хак'] });

    expect(res.status).toBe(403);
    expect(fakeDb.tagNames()).not.toContain('хак');
  });
});
