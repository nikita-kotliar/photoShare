process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
process.env.GOOGLE_REDIRECT_URI = 'https://example.com/api/auth/google/callback';
process.env.APP_URL = 'https://example.com/photoshare/';

jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const fakeDb = require('./helpers/fakeDb');
const { app, agent } = require('./helpers/app');
const { signedIn } = require('./helpers/fixtures');
const { freeUsername } = require('../src/services/googleAuthService');

const APP = 'https://example.com/photoshare';
let fetchSpy;

beforeEach(() => {
  fakeDb.reset();
  fetchSpy = jest.spyOn(global, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

function idToken(overrides = {}) {
  return jwt.sign(
    {
      iss: 'https://accounts.google.com',
      aud: process.env.GOOGLE_CLIENT_ID,
      sub: 'google-123',
      email: 'Olena@Gmail.com',
      email_verified: true,
      name: 'Олена Коваль',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    },
    'google-signs-this',
  );
}

function googleAnswers(claims, status = 200) {
  fetchSpy.mockResolvedValueOnce(
    new Response(JSON.stringify({ id_token: idToken(claims) }), { status }),
  );
}

async function startLogin(client = agent()) {
  const res = await client.get('/api/auth/google');
  const location = new URL(res.headers.location);
  return { client, res, state: location.searchParams.get('state'), location };
}

async function finish(claims, query = {}) {
  const { client, state } = await startLogin();
  if (claims !== undefined) googleAnswers(claims);
  const params = new URLSearchParams({ code: 'auth-code', state, ...query });
  const res = await client.get(`/api/auth/google/callback?${params}`);
  return { client, res };
}

describe('GET /api/auth/google', () => {
  it('веде на Google з PKCE і state, state у короткій httpOnly cookie', async () => {
    const { res, location } = await startLogin();

    expect(res.status).toBe(302);
    expect(location.origin + location.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(Object.fromEntries(location.searchParams)).toMatchObject({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge_method: 'S256',
    });
    expect(location.searchParams.get('state')).toHaveLength(32);
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token_oauth='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Max-Age=600/);
  });
});

describe('GET /api/auth/google/callback', () => {
  it('новий користувач: створюється без пароля, сесія і перехід на /home', async () => {
    const { client, res } = await finish({});

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${APP}/home`);
    const me = await client.get('/api/users/me');
    expect(me.body.user).toMatchObject({
      username: 'olena',
      email: 'olena@gmail.com',
      name: 'Олена Коваль',
      googleLinked: true,
      role: 'ADMIN',
    });
    const saved = await fakeDb.user.findUnique({ where: { username: 'olena' } });
    expect(saved.passwordHash).toBeNull();

    const [, body] = fetchSpy.mock.calls[0];
    expect(Object.fromEntries(body.body)).toMatchObject({
      code: 'auth-code',
      grant_type: 'authorization_code',
      client_secret: 'client-secret',
    });
    expect(body.body.get('code_verifier')).toHaveLength(43);
  });

  it('наявний акаунт з тим самим email прив’язується, а не дублюється', async () => {
    const owner = await signedIn('olena');
    await fakeDb.user.update({ where: { id: owner.user.id }, data: { email: 'olena@gmail.com' } });

    const { client } = await finish({});
    const me = await client.get('/api/users/me');

    expect(me.body.user).toMatchObject({ id: owner.user.id, googleLinked: true, role: 'ADMIN' });
    expect(await fakeDb.user.count()).toBe(1);
  });

  it('повторний вхід знаходить користувача за Google id, навіть після зміни email', async () => {
    const first = await finish({});
    const id = (await first.client.get('/api/users/me')).body.user.id;
    const again = await finish({ email: 'new@gmail.com' });

    expect((await again.client.get('/api/users/me')).body.user.id).toBe(id);
    expect(await fakeDb.user.count()).toBe(1);
  });

  it('другий користувач не адмін; зайнятий юзернейм отримує номер', async () => {
    await signedIn('olena');
    const { client } = await finish({});

    expect((await client.get('/api/users/me')).body.user).toMatchObject({
      username: 'olena2',
      role: 'USER',
    });
  });

  it.each([
    ['відмова на сторінці Google', undefined, { error: 'access_denied' }, 'cancelled'],
    ['пошта не підтверджена', { email_verified: false }, {}, 'email_unverified'],
    ['id_token для іншого клієнта', { aud: 'someone-else' }, {}, 'unavailable'],
    ['прострочений id_token', { exp: 1000 }, {}, 'unavailable'],
    ['чужий видавець', { iss: 'https://evil.example.com' }, {}, 'unavailable'],
  ])('%s: назад на /auth з кодом %s, без сесії', async (_name, claims, query, code) => {
    const { client, res } = await finish(claims, query);

    expect(res.headers.location).toBe(`${APP}/auth?googleError=${code}`);
    expect((await client.get('/api/users/me')).status).toBe(401);
    expect(await fakeDb.user.count()).toBe(0);
  });

  it('підроблений state не приймається і Google не викликається', async () => {
    const { client } = await startLogin();
    const res = await client.get('/api/auth/google/callback?code=x&state=forged');

    expect(res.headers.location).toBe(`${APP}/auth?googleError=unavailable`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('без cookie зі state (інший браузер) вхід не відбувається', async () => {
    const { state } = await startLogin();
    const res = await request(app).get(`/api/auth/google/callback?code=x&state=${state}`);

    expect(res.headers.location).toBe(`${APP}/auth?googleError=unavailable`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Google відповів помилкою або недоступний: unavailable', async () => {
    const { client, state } = await startLogin();
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 400 }));
    const bad = await client.get(`/api/auth/google/callback?code=x&state=${state}`);

    const second = await startLogin();
    fetchSpy.mockRejectedValueOnce(new Error('ECONNRESET'));
    const down = await second.client.get(`/api/auth/google/callback?code=x&state=${second.state}`);

    expect(bad.headers.location).toBe(`${APP}/auth?googleError=unavailable`);
    expect(down.headers.location).toBe(`${APP}/auth?googleError=unavailable`);
  });

  it('забанений через Google не входить', async () => {
    const first = await finish({});
    const id = (await first.client.get('/api/users/me')).body.user.id;
    await fakeDb.user.update({ where: { id }, data: { isActive: false } });

    const { client, res } = await finish({});

    expect(res.headers.location).toBe(`${APP}/auth?googleError=banned`);
    expect(res.headers['set-cookie'].some((c) => /^token=[^;]/.test(c))).toBe(false);
    expect((await client.get('/api/users/me')).status).not.toBe(200);
  });

  it('збій бази не видає внутрішній код помилки в адресу', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { client, state } = await startLogin();
    googleAnswers({});
    jest.spyOn(fakeDb.user, 'findUnique').mockRejectedValueOnce(new Error('db down'));

    const res = await client.get(`/api/auth/google/callback?code=x&state=${state}`);

    expect(res.headers.location).toBe(`${APP}/auth?googleError=unavailable`);
  });

  it('користувач без пароля не входить паролем', async () => {
    await finish({});
    const res = await agent()
      .post('/api/sessions')
      .send({ email: 'olena@gmail.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});

describe('freeUsername', () => {
  it('прибирає зайві символи і доповнює короткі імена', async () => {
    expect(await freeUsername('ol+ena!@gmail.com')).toBe('olena');
    expect(await freeUsername('a@b.c')).toBe('usera');
  });
});
