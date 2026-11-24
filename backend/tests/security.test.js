jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const fakeDb = require('./helpers/fakeDb');
const { agent, register } = require('./helpers/app');
const { rateLimit } = require('../src/middleware/rateLimit');

beforeEach(() => {
  fakeDb.reset();
});

describe('ліміти запитів', () => {
  it('11-та спроба входу за 15 хвилин: 429 RATE_LIMIT з Retry-After', async () => {
    await register(agent(), { username: 'owner', email: 'owner@example.com' });
    const client = agent();
    for (let i = 0; i < 10; i += 1) {
      const res = await client
        .post('/api/sessions')
        .send({ email: 'owner@example.com', password: 'wrong-pass' });
      expect(res.status).toBe(401);
    }
    const blocked = await client
      .post('/api/sessions')
      .send({ email: 'owner@example.com', password: 'wrong-pass' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMIT');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('21-ша реєстрація з однієї адреси за годину: 429', async () => {
    for (let i = 0; i < 20; i += 1) {
      const res = await register(agent(), { username: `user${i}`, email: `user${i}@example.com` });
      expect(res.status).toBe(201);
    }
    const blocked = await register(agent(), { username: 'extra', email: 'extra@example.com' });

    expect(blocked.status).toBe(429);
    expect(await fakeDb.user.count()).toBe(20);
  });

  it('вікно ліміту закінчується, різні ключі рахуються окремо', () => {
    jest.useFakeTimers({ now: 0 });
    const limit = rateLimit({ windowMs: 1000, max: 1, key: (req) => req.ip, message: 'x' });
    const run = (ip) => {
      let error;
      limit({ ip }, { set() {} }, (err) => {
        error = err;
      });
      return error?.status ?? 200;
    };

    expect([run('a'), run('a'), run('b')]).toEqual([200, 429, 200]);
    jest.setSystemTime(1001);
    expect(run('a')).toBe(200);
    jest.useRealTimers();
  });
});

describe('заголовки безпеки', () => {
  it('helmet: nosniff, без X-Powered-By, cookie сесії httpOnly і SameSite', async () => {
    const res = await register(agent(), { username: 'owner', email: 'owner@example.com' });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('у відповіді користувача немає хешу пароля і Google id', async () => {
    const res = await register(agent(), { username: 'owner', email: 'owner@example.com' });

    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|googleId/);
  });
});

describe('GET /api/sessions', () => {
  it('гостю 200 з user null, а не 401: на сайті немає помилки в консолі', async () => {
    const res = await agent().get('/api/sessions');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it('з сесією повертає користувача; після виходу і для забаненого - null', async () => {
    const client = agent();
    const { body } = await register(client, { username: 'owner', email: 'owner@example.com' });
    expect((await client.get('/api/sessions')).body.user).toMatchObject({ id: body.user.id });

    await fakeDb.user.update({ where: { id: body.user.id }, data: { isActive: false } });
    expect((await client.get('/api/sessions')).body).toEqual({ user: null });

    await fakeDb.user.update({ where: { id: body.user.id }, data: { isActive: true } });
    await client.delete('/api/sessions').expect(204);
    expect((await client.get('/api/sessions')).body).toEqual({ user: null });
  });
});
