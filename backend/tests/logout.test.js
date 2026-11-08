jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const fakeDb = require('./helpers/fakeDb');
const env = require('../src/config/env');
const blacklistService = require('../src/services/blacklistService');
const { cleanBlacklist, startCleanBlacklist } = require('../src/jobs/cleanBlacklist');
const { app, agent, register, defaultUser } = require('./helpers/app');

beforeEach(() => {
  fakeDb.reset();
});

function tokenCookie(res) {
  return res.headers['set-cookie'].find((cookie) => cookie.startsWith('token=')).split(';')[0];
}

function tokenOf(cookie) {
  return jwt.decode(cookie.slice('token='.length));
}

function me(cookie) {
  return request(app).get('/api/users/me').set('Cookie', cookie);
}

function logout(cookie) {
  return request(app).delete('/api/sessions').set('Cookie', cookie);
}

function login() {
  return request(app)
    .post('/api/sessions')
    .send({ email: defaultUser.email, password: defaultUser.password });
}

describe('DELETE /api/sessions', () => {
  it('після виходу старий токен повертає 401', async () => {
    const cookie = tokenCookie(await register(agent()));
    expect((await me(cookie)).status).toBe(200);

    const res = await logout(cookie);
    const after = await me(cookie);

    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'].join(';')).toMatch(/token=;/);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('TOKEN_INVALID');
  });

  it('записує jti в blacklist до кінця життя токена', async () => {
    const cookie = tokenCookie(await register(agent()));
    const { jti, exp } = tokenOf(cookie);

    await logout(cookie);

    const entry = await fakeDb.tokenBlacklist.findUnique({ where: { jti } });
    expect(entry.expiresAt).toEqual(new Date(exp * 1000));
  });

  it('інші сесії користувача продовжують працювати, новий вхід теж', async () => {
    await register(agent());
    const first = tokenCookie(await login());
    const second = tokenCookie(await login());

    await logout(first);
    const fresh = tokenCookie(await login());

    expect((await me(first)).status).toBe(401);
    expect((await me(second)).status).toBe(200);
    expect((await me(fresh)).status).toBe(200);
  });

  it('повторний вихід, вихід без cookie і з битим токеном повертають 204', async () => {
    const cookie = tokenCookie(await register(agent()));

    const twice = [await logout(cookie), await logout(cookie)];
    const noCookie = await request(app).delete('/api/sessions');
    const broken = await logout('token=not-a-jwt');
    const expired = await logout(
      `token=${jwt.sign({ sub: '1', exp: Math.floor(Date.now() / 1000) - 10 }, env.JWT_SECRET, { jwtid: 'old' })}`,
    );

    for (const res of [...twice, noCookie, broken, expired]) {
      expect(res.status).toBe(204);
    }
    expect(await blacklistService.isRevoked('old')).toBe(false);
  });

  it('забанений користувач теж може вийти, і його токен блокується', async () => {
    const cookie = tokenCookie(await register(agent()));
    await fakeDb.user.update({ where: { id: 1 }, data: { isActive: false } });

    const res = await logout(cookie);

    expect(res.status).toBe(204);
    expect(await blacklistService.isRevoked(tokenOf(cookie).jti)).toBe(true);
  });

  it('токен без jti не приймається', async () => {
    await register(agent());
    const token = jwt.sign({ sub: '1' }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await me(`token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});

describe('очищення blacklist', () => {
  async function seed() {
    const now = Date.now();
    await blacklistService.revoke({ jti: 'expired', exp: Math.floor((now - 60_000) / 1000) });
    await blacklistService.revoke({ jti: 'active', exp: Math.floor((now + 60_000) / 1000) });
  }

  it('cleanExpired видаляє лише прострочені записи', async () => {
    await seed();

    const count = await blacklistService.cleanExpired();

    expect(count).toBe(1);
    expect(await blacklistService.isRevoked('expired')).toBe(false);
    expect(await blacklistService.isRevoked('active')).toBe(true);
  });

  it('job пише в лог кількість видалених і не падає при помилці БД', async () => {
    await seed();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    await cleanBlacklist();
    jest.spyOn(fakeDb.tokenBlacklist, 'deleteMany').mockRejectedValueOnce(new Error('db down'));
    await expect(cleanBlacklist()).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(expect.stringContaining('1'));
    expect(error).toHaveBeenCalledWith(expect.any(String), 'db down');
    jest.restoreAllMocks();
  });

  it('job запускається одразу, потім за інтервалом, і зупиняється', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(blacklistService, 'cleanExpired').mockResolvedValue(0);

    const stop = startCleanBlacklist(1000);
    expect(spy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2000);
    expect(spy).toHaveBeenCalledTimes(3);
    stop();
    jest.advanceTimersByTime(5000);
    expect(spy).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
    jest.restoreAllMocks();
  });
});
