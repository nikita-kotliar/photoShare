jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const { cloud, v2: cloudinary } = require('cloudinary');
const fakeDb = require('./helpers/fakeDb');
const { agent } = require('./helpers/app');
const { PNG, team, upload } = require('./helpers/fixtures');

beforeEach(() => {
  fakeDb.reset();
  jest.clearAllMocks();
});

describe('POST /api/photos', () => {
  it('без авторизації повертає 401', async () => {
    const res = await upload(agent());
    expect(res.status).toBe(401);
    expect(cloud.files.size).toBe(0);
  });

  it('завантажує світлину в Cloudinary і повертає photo', async () => {
    const { owner } = await team();
    const res = await upload(owner.client, '  Захід сонця  ');

    expect(res.status).toBe(201);
    expect(cloud.files.get('photoshare/p1')).toEqual(PNG);
    expect(res.body.photo).toMatchObject({
      id: 1,
      url: 'https://res.cloudinary.com/demo/image/upload/photoshare/p1.png',
      description: 'Захід сонця',
      tags: [],
      author: { id: owner.user.id, username: 'owner', name: 'owner', avatarUrl: null },
      averageRating: null,
      ratingsCount: 0,
      commentsCount: 0,
      myRating: null,
    });
    expect(res.body.photo.slug).toMatch(/^[\w-]{12}$/);
    expect(res.body.photo.publicId).toBeUndefined();
    expect(res.body.photo.author.email).toBeUndefined();
  });

  it('без файлу повертає 422 з помилкою поля image', async () => {
    const { owner } = await team();
    const res = await owner.client.post('/api/photos').field('description', 'Без файлу');

    expect(res.status).toBe(422);
    expect(res.body.error.fields.image).toBeDefined();
  });

  it('перевіряє тип за вмістом, а не за розширенням', async () => {
    const { owner } = await team();
    const res = await upload(
      owner.client,
      'Не картинка',
      Buffer.from('<script>alert(1)</script>'),
      'fake.png',
    );

    expect(res.status).toBe(422);
    expect(res.body.error.fields.image).toMatch(/JPEG, PNG, WEBP або GIF/);
    expect(cloud.files.size).toBe(0);
  });

  it('файл більше 10 МБ повертає 413', async () => {
    const { owner } = await team();
    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    const res = await upload(owner.client, 'Завелика', big);

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('порожній або задовгий опис повертає 422', async () => {
    const { owner } = await team();
    const empty = await upload(owner.client, '   ');
    const long = await upload(owner.client, 'a'.repeat(1001));

    expect(empty.status).toBe(422);
    expect(empty.body.error.fields.description).toBeDefined();
    expect(long.status).toBe(422);
    expect(cloud.files.size).toBe(0);
  });

  it('видаляє файл з Cloudinary, якщо запис у БД не створився', async () => {
    const { owner } = await team();
    const spy = jest.spyOn(fakeDb.photo, 'create').mockRejectedValueOnce(new Error('db down'));
    const res = await upload(owner.client);

    expect(res.status).toBe(500);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('photoshare/p1', expect.any(Object));
    expect(cloud.files.size).toBe(0);
    spy.mockRestore();
  });

  it('з трансформаціями зберігає URL трансформованого зображення', async () => {
    const { owner } = await team();
    const transformations = { effect: 'sepia', angle: 90, crop: 'square' };
    const res = await upload(owner.client).field(
      'transformations',
      JSON.stringify(transformations),
    );

    expect(res.status).toBe(201);
    expect(cloud.files.get('photoshare/p1')).toEqual(PNG);
    expect(res.body.photo.url).toBe(
      'https://res.cloudinary.com/demo/image/upload/ar_1:1,c_fill,g_auto/a_90/e_sepia/v1/photoshare/p1',
    );
  });

  it('некоректні трансформації повертають 422 і не вантажать файл', async () => {
    const { owner } = await team();
    const cases = [
      ['{"effect":"vintage"}', 'transformations.effect'],
      ['{"angle":360}', 'transformations.angle'],
      ['{"angle":12.5}', 'transformations.angle'],
      ['{"crop":"circle"}', 'transformations.crop'],
      ['{"width":100}', 'transformations'],
      ['не json', 'transformations'],
    ];

    for (const [value, field] of cases) {
      const res = await upload(owner.client).field('transformations', value);
      expect(res.status).toBe(422);
      expect(res.body.error.fields[field]).toBeDefined();
    }
    expect(cloud.files.size).toBe(0);
  });
});

describe('GET /api/photos', () => {
  it('без авторизації повертає 401', async () => {
    const res = await agent().get('/api/photos');
    expect(res.status).toBe(401);
  });

  it('повертає стрічку з пагінацією, нові першими', async () => {
    const { owner } = await team();
    for (const text of ['перша', 'друга', 'третя']) {
      await upload(owner.client, text);
    }

    const res = await owner.client.get('/api/photos?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, limit: 2, pages: 2 });
    expect(res.body.items.map((photo) => photo.description)).toEqual(['третя', 'друга']);

    const second = await owner.client.get('/api/photos?page=2&limit=2');
    expect(second.body.items.map((photo) => photo.description)).toEqual(['перша']);
  });

  it('за замовчуванням page=1 і limit=12', async () => {
    const { owner } = await team();
    const res = await owner.client.get('/api/photos');

    expect(res.body).toEqual({ items: [], total: 0, page: 1, limit: 12, pages: 0 });
  });

  it('limit більше 50 повертає 422', async () => {
    const { owner } = await team();
    const res = await owner.client.get('/api/photos?limit=51');

    expect(res.status).toBe(422);
    expect(res.body.error.fields.limit).toBeDefined();
  });
});

describe('GET /api/photos/:idOrSlug', () => {
  it('публічно віддає світлину за id і за slug', async () => {
    const { owner } = await team();
    const { photo } = (await upload(owner.client)).body;

    const byId = await agent().get(`/api/photos/${photo.id}`);
    const bySlug = await agent().get(`/api/photos/${photo.slug}`);

    expect(byId.status).toBe(200);
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.photo.id).toBe(photo.id);
  });

  it('id за межами INTEGER повертає 422, а не помилку БД', async () => {
    const res = await agent().get('/api/photos/99999999999');
    expect(res.status).toBe(422);
  });

  it('неіснуюча світлина повертає 404', async () => {
    const res = await agent().get('/api/photos/999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PUT /api/photos/:id', () => {
  it('власник редагує опис', async () => {
    const { owner } = await team();
    const { photo } = (await upload(owner.client)).body;

    const res = await owner.client
      .put(`/api/photos/${photo.id}`)
      .send({ description: 'Новий опис' });

    expect(res.status).toBe(200);
    expect(res.body.photo.description).toBe('Новий опис');
  });

  it('чужу світлину змінити не можна', async () => {
    const { owner, stranger } = await team();
    const { photo } = (await upload(owner.client)).body;

    const res = await stranger.client.put(`/api/photos/${photo.id}`).send({ description: 'Злам' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const after = await agent().get(`/api/photos/${photo.id}`);
    expect(after.body.photo.description).toBe('Захід сонця');
  });

  it('модератор чужу світлину змінити не може', async () => {
    const { owner, stranger } = await team();
    await fakeDb.user.update({ where: { id: stranger.user.id }, data: { role: 'MODERATOR' } });
    const { photo } = (await upload(owner.client)).body;

    const res = await stranger.client
      .put(`/api/photos/${photo.id}`)
      .send({ description: 'Модерація' });

    expect(res.status).toBe(403);
  });

  it('ADMIN редагує будь-яку світлину', async () => {
    const { admin, owner } = await team();
    const { photo } = (await upload(owner.client)).body;

    const res = await admin.client
      .put(`/api/photos/${photo.id}`)
      .send({ description: 'Від адміна' });

    expect(res.status).toBe(200);
    expect(res.body.photo.description).toBe('Від адміна');
  });

  it('повертає 404 для неіснуючої і 422 для некоректного id', async () => {
    const { owner } = await team();
    const missing = await owner.client.put('/api/photos/42').send({ description: 'x' });
    const invalid = await owner.client.put('/api/photos/abc').send({ description: 'x' });

    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.fields.id).toBeDefined();
  });

  it('порожній опис повертає 422', async () => {
    const { owner } = await team();
    const { photo } = (await upload(owner.client)).body;

    const res = await owner.client.put(`/api/photos/${photo.id}`).send({ description: '' });

    expect(res.status).toBe(422);
    expect(res.body.error.fields.description).toBeDefined();
  });
});

describe('DELETE /api/photos/:id', () => {
  it('власник видаляє світлину разом з файлом у Cloudinary', async () => {
    const { owner } = await team();
    const { photo } = (await upload(owner.client)).body;

    const res = await owner.client.delete(`/api/photos/${photo.id}`);

    expect(res.status).toBe(204);
    expect(cloud.files.has('photoshare/p1')).toBe(false);
    expect((await agent().get(`/api/photos/${photo.id}`)).status).toBe(404);
  });

  it('чужу світлину видалити не можна', async () => {
    const { owner, stranger } = await team();
    const { photo } = (await upload(owner.client)).body;

    const res = await stranger.client.delete(`/api/photos/${photo.id}`);

    expect(res.status).toBe(403);
    expect(cloud.files.has('photoshare/p1')).toBe(true);
  });

  it('ADMIN видаляє будь-яку світлину', async () => {
    const { admin, owner } = await team();
    const { photo } = (await upload(owner.client)).body;

    const res = await admin.client.delete(`/api/photos/${photo.id}`);

    expect(res.status).toBe(204);
  });

  it('збій Cloudinary не ламає видалення', async () => {
    const { owner } = await team();
    const { photo } = (await upload(owner.client)).body;
    cloud.failNext(new Error('timeout'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await owner.client.delete(`/api/photos/${photo.id}`);

    expect(res.status).toBe(204);
    log.mockRestore();
  });
});
