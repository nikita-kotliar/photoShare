jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const fakeDb = require('./helpers/fakeDb');
const { agent, register } = require('./helpers/app');
const { signedIn, team, upload } = require('./helpers/fixtures');

beforeEach(() => {
  fakeDb.reset();
  jest.clearAllMocks();
});

const PRIVATE_FIELDS = ['email', 'passwordHash', 'password', 'role', 'isActive', 'id'];

describe('GET /api/users/:username', () => {
  it('віддає публічні дані й кількість світлин без email і хеша', async () => {
    const { owner } = await team();
    await upload(owner.client, 'Перша');
    await upload(owner.client, 'Друга');

    const res = await agent().get('/api/users/owner');

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      username: 'owner',
      name: 'owner',
      avatarUrl: null,
      createdAt: expect.any(String),
      photosCount: 2,
    });
    for (const field of PRIVATE_FIELDS) {
      expect(res.body.user[field]).toBeUndefined();
    }
  });

  it('рахує лише світлини цього користувача', async () => {
    const { owner, stranger } = await team();
    await upload(owner.client);
    await upload(stranger.client);

    const res = await agent().get('/api/users/stranger');
    expect(res.body.user.photosCount).toBe(1);
  });

  it('користувач без світлин має photosCount 0', async () => {
    await signedIn('empty');
    const res = await agent().get('/api/users/empty');
    expect(res.body.user.photosCount).toBe(0);
  });

  it('неіснуючий юзернейм повертає 404', async () => {
    const res = await agent().get('/api/users/nobody');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('некоректний юзернейм повертає 422', async () => {
    const res = await agent().get('/api/users/bad%20name');
    expect(res.status).toBe(422);
  });
});

describe('GET /api/users/:username/photos', () => {
  it('віддає лише світлини цього користувача з пагінацією', async () => {
    const { owner, stranger } = await team();
    await upload(owner.client, 'Одна');
    await upload(owner.client, 'Дві');
    await upload(owner.client, 'Три');
    await upload(stranger.client, 'Чужа');

    const res = await agent().get('/api/users/owner/photos?limit=2');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, limit: 2, pages: 2 });
    expect(res.body.items.map((p) => p.description)).toEqual(['Три', 'Дві']);
    expect(res.body.items.every((p) => p.author.username === 'owner')).toBe(true);

    const second = await agent().get('/api/users/owner/photos?limit=2&page=2');
    expect(second.body.items.map((p) => p.description)).toEqual(['Одна']);
  });

  it('неіснуючий користувач повертає 404, а некоректна сторінка 422', async () => {
    await signedIn('someone');
    expect((await agent().get('/api/users/nobody/photos')).status).toBe(404);
    expect((await agent().get('/api/users/someone/photos?page=0')).status).toBe(422);
  });
});

describe('GET /api/users/me', () => {
  it('віддає власні дані з email', async () => {
    const { client } = await signedIn('owner');
    const res = await client.get('/api/users/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'owner', email: 'owner@example.com' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('без авторизації повертає 401', async () => {
    const res = await agent().get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/users/me', () => {
  it('змінює ім’я, юзернейм і email', async () => {
    const { client } = await signedIn('owner');
    const res = await client
      .put('/api/users/me')
      .send({ name: '  Ксенія  ', username: 'ksenia', email: 'Ksenia@Example.com' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      name: 'Ксенія',
      username: 'ksenia',
      email: 'ksenia@example.com',
    });
    expect((await agent().get('/api/users/ksenia')).status).toBe(200);
    expect((await agent().get('/api/users/owner')).status).toBe(404);
  });

  it('змінює лише передані поля', async () => {
    const { client } = await signedIn('owner');
    const res = await client.put('/api/users/me').send({ name: 'Нове ім’я' });

    expect(res.body.user).toMatchObject({
      name: 'Нове ім’я',
      username: 'owner',
      email: 'owner@example.com',
    });
  });

  it('змінює лише дані поточного користувача', async () => {
    const { owner, stranger } = await team();
    await owner.client.put('/api/users/me').send({ name: 'Змінено' });

    const other = await stranger.client.get('/api/users/me');
    expect(other.body.user.name).toBe('stranger');
  });

  it('ігнорує role, isActive, id і passwordHash', async () => {
    const { stranger } = await team();
    const res = await stranger.client.put('/api/users/me').send({
      name: 'Хакер',
      role: 'ADMIN',
      isActive: false,
      id: 1,
      passwordHash: 'x',
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: stranger.user.id, role: 'USER', isActive: true });
    const stored = await fakeDb.user.findUnique({ where: { id: stranger.user.id } });
    expect(stored.passwordHash).not.toBe('x');
  });

  it('зайнятий юзернейм або email повертає 409 і нічого не змінює', async () => {
    const { owner, stranger } = await team();

    const username = await stranger.client.put('/api/users/me').send({ username: 'owner' });
    expect(username.status).toBe(409);
    expect(username.body.error.fields.username).toBeDefined();

    const email = await stranger.client
      .put('/api/users/me')
      .send({ name: 'Новий', email: 'owner@example.com' });
    expect(email.status).toBe(409);
    expect(email.body.error.fields.email).toBeDefined();

    const both = await stranger.client
      .put('/api/users/me')
      .send({ username: 'owner', email: 'admin@example.com' });
    expect(Object.keys(both.body.error.fields).sort()).toEqual(['email', 'username']);

    const after = await stranger.client.get('/api/users/me');
    expect(after.body.user).toMatchObject({ name: 'stranger', username: 'stranger' });
    expect(owner.user.username).toBe('owner');
  });

  it('власні поточні username і email не вважаються дублікатом', async () => {
    const { client } = await signedIn('owner');
    const res = await client
      .put('/api/users/me')
      .send({ username: 'owner', email: 'owner@example.com', name: 'Той самий' });
    expect(res.status).toBe(200);
  });

  it('конфлікт під час запису (гонка) також повертає 409', async () => {
    const { owner, stranger } = await team();
    // Перевірка "проходить" (юзернейм здається вільним), а запис падає на унікальному індексі
    const real = fakeDb.user.findUnique;
    fakeDb.user.findUnique = async (args) => (args.where.username === 'owner' ? null : real(args));
    const res = await stranger.client.put('/api/users/me').send({ username: 'owner' });
    fakeDb.user.findUnique = real;

    expect(res.status).toBe(409);
    expect(res.body.error.fields.username).toBeDefined();
    expect(owner.user.username).toBe('owner');
  });

  it('некоректні дані повертають 422', async () => {
    const { client } = await signedIn('owner');
    const bad = await client
      .put('/api/users/me')
      .send({ name: '   ', username: 'a b', email: 'not-an-email' });

    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['email', 'name', 'username']);

    const empty = await client.put('/api/users/me').send({});
    expect(empty.status).toBe(422);
  });

  it('юзернейм "me" зарезервовано', async () => {
    const { client } = await signedIn('owner');
    const res = await client.put('/api/users/me').send({ username: 'Me' });
    expect(res.status).toBe(422);
    expect((await register(agent(), { username: 'me', email: 'x@example.com' })).status).toBe(422);
  });

  it('без авторизації повертає 401', async () => {
    const res = await agent().put('/api/users/me').send({ name: 'Хтось' });
    expect(res.status).toBe(401);
  });
});
