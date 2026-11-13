const request = require('supertest');

const saved = process.env;

function loadApp(vars) {
  process.env = { ...saved, ...vars };
  let app;
  let env;
  jest.isolateModules(() => {
    jest.doMock('../src/config/db', () => require('./helpers/fakeDb'));
    env = require('../src/config/env');
    app = require('../src/app');
    require('./helpers/fakeDb').reset();
  });
  return { app, env };
}

afterEach(() => {
  process.env = saved;
});

describe('налаштування для деплою з підшляху', () => {
  it('за замовчуванням cookie token на / і API на /api', () => {
    const { env } = loadApp({});

    expect(env.COOKIE_NAME).toBe('token');
    expect(env.COOKIE_PATH).toBe('/');
    expect(env.PUBLIC_API_PATH).toBe('/api');
  });

  it('некоректні значення не пропускає', () => {
    expect(() => loadApp({ COOKIE_NAME: 'bad name;' })).toThrow(/COOKIE_NAME/);
    expect(() => loadApp({ COOKIE_PATH: 'photoshare-api/' })).toThrow(/COOKIE_PATH/);
    expect(() => loadApp({ PUBLIC_API_PATH: 'api' })).toThrow(/PUBLIC_API_PATH/);
  });

  it('cookie з власною назвою і шляхом, вхід працює', async () => {
    const { app } = loadApp({ COOKIE_NAME: 'photoshare_token', COOKIE_PATH: '/photoshare-api/' });
    const res = await request(app).post('/api/users').send({
      username: 'nikita',
      email: 'nikita@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('photoshare_token='));
    expect(cookie).toMatch(/Path=\/photoshare-api\//);
    expect(cookie).toMatch(/HttpOnly/);

    const me = await request(app).get('/api/users/me').set('Cookie', cookie.split(';')[0]);
    expect(me.status).toBe(200);

    const stale = await request(app).get('/api/users/me').set('Cookie', 'token=whatever');
    expect(stale.status).toBe(401);

    const logout = await request(app).delete('/api/sessions').set('Cookie', cookie.split(';')[0]);
    expect(logout.headers['set-cookie'][0]).toMatch(/^photoshare_token=;.*Path=\/photoshare-api\//);
  });

  it('Swagger показує публічний шлях API', async () => {
    const { app } = loadApp({ PUBLIC_API_PATH: '/photoshare-api' });
    const res = await request(app).get('/api/docs.json');

    expect(res.body.servers).toEqual([{ url: '/photoshare-api' }]);
  });
});
