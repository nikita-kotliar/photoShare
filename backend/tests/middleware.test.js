jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const fakeDb = require('./helpers/fakeDb');
const { authenticate } = require('../src/middleware/auth');
const { requireRole } = require('../src/middleware/roles');
const { errorHandler } = require('../src/middleware/errorHandler');
const { agent, register } = require('./helpers/app');

// =========
// Тестовий застосунок з ролями
const testApp = express();
testApp.use(cookieParser());
testApp.get('/admin', authenticate, requireRole('ADMIN'), (_req, res) => {
  res.json({ ok: true });
});
testApp.get('/staff', authenticate, requireRole('ADMIN', 'MODERATOR'), (_req, res) => {
  res.json({ ok: true });
});
testApp.use(errorHandler);

beforeEach(() => fakeDb.reset());

describe('GET /api/health', () => {
  it('повертає 200', async () => {
    const res = await agent().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('невідомий маршрут API повертає 404 у форматі помилки', async () => {
    const res = await agent().get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('authenticate', () => {
  it('повертає 401 без cookie', async () => {
    const res = await agent().get('/api/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('повертає 401 для підробленого токена', async () => {
    const res = await agent().get('/api/users/me').set('Cookie', 'token=fake.token.value');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('повертає 401 для токена, підписаного іншим секретом', async () => {
    const token = jwt.sign({ sub: '1' }, 'another-secret-another-secret');
    const res = await agent().get('/api/users/me').set('Cookie', `token=${token}`);
    expect(res.status).toBe(401);
  });

  it('повертає 401, якщо користувача видалено', async () => {
    const a = agent();
    await register(a);
    fakeDb.reset();

    const res = await a.get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('повертає поточного користувача з валідною сесією', async () => {
    const a = agent();
    await register(a);

    const res = await a.get('/api/users/me');
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('nikita');
  });

  it('повертає 403 USER_BANNED, якщо користувача забанили після входу', async () => {
    const a = agent();
    await register(a);
    await fakeDb.user.update({ where: { id: 1 }, data: { isActive: false } });

    const res = await a.get('/api/users/me');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USER_BANNED');
  });
});

describe('requireRole', () => {
  async function tokenFor(role) {
    const a = agent();
    await register(a, { username: 'first', email: 'first@example.com' });
    const second = await register(a, { username: 'other', email: 'other@example.com' });
    await fakeDb.user.update({ where: { id: second.body.user.id }, data: { role } });
    const token = jwt.sign({ sub: String(second.body.user.id) }, process.env.JWT_SECRET);
    return `token=${token}`;
  }

  it('пропускає ADMIN', async () => {
    const res = await request(testApp)
      .get('/admin')
      .set('Cookie', await tokenFor('ADMIN'));
    expect(res.status).toBe(200);
  });

  it('повертає 403 для USER на маршруті ADMIN', async () => {
    const res = await request(testApp)
      .get('/admin')
      .set('Cookie', await tokenFor('USER'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('MODERATOR проходить на маршрут для персоналу, але не на ADMIN', async () => {
    const cookie = await tokenFor('MODERATOR');
    const staff = await request(testApp).get('/staff').set('Cookie', cookie);
    const admin = await request(testApp).get('/admin').set('Cookie', cookie);

    expect(staff.status).toBe(200);
    expect(admin.status).toBe(403);
  });

  it('повертає 401 без сесії', async () => {
    const res = await request(testApp).get('/admin');
    expect(res.status).toBe(401);
  });
});
