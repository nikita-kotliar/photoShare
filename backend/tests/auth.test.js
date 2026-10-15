jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const fakeDb = require('./helpers/fakeDb');
const { agent, register, defaultUser } = require('./helpers/app');

beforeEach(() => fakeDb.reset());

describe('POST /api/users', () => {
  it('реєструє користувача, ставить httpOnly cookie і не повертає пароль', async () => {
    const res = await register(agent());

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      username: 'nikita',
      email: 'nikita@example.com',
      name: 'nikita',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();

    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/token=/);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('перший користувач стає ADMIN, другий - USER', async () => {
    const first = await register(agent());
    const second = await register(agent(), {
      username: 'second',
      email: 'second@example.com',
    });

    expect(first.body.user.role).toBe('ADMIN');
    expect(second.body.user.role).toBe('USER');
  });

  it('нормалізує email до нижнього регістру', async () => {
    const res = await register(agent(), { email: 'Nikita@Example.COM' });
    expect(res.body.user.email).toBe('nikita@example.com');
  });

  it('повертає 409 для дубліката email', async () => {
    await register(agent());
    const res = await register(agent(), { username: 'other' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.fields.email).toBeDefined();
  });

  it('повертає 409 для дубліката username', async () => {
    await register(agent());
    const res = await register(agent(), { email: 'other@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.fields.username).toBeDefined();
  });

  it('повертає 422 з помилками по полях для невалідних даних', async () => {
    const res = await agent()
      .post('/api/users')
      .send({ username: 'ab', email: 'not-email', password: '123' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['email', 'password', 'username']);
  });

  it('повертає 400 для некоректного JSON', async () => {
    const res = await agent()
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send('{bad json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('POST /api/sessions', () => {
  beforeEach(async () => {
    await register(agent());
  });

  it('входить з правильними даними і ставить cookie', async () => {
    const res = await agent()
      .post('/api/sessions')
      .send({ email: defaultUser.email, password: defaultUser.password });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('nikita');
    expect(res.headers['set-cookie'].join(';')).toMatch(/token=.+HttpOnly/i);
  });

  it('повертає 401 для неправильного пароля', async () => {
    const res = await agent()
      .post('/api/sessions')
      .send({ email: defaultUser.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('повертає 401 для неіснуючого email', async () => {
    const res = await agent()
      .post('/api/sessions')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('повертає 403 для забаненого користувача', async () => {
    await fakeDb.user.update({
      where: { email: defaultUser.email },
      data: { isActive: false },
    });

    const res = await agent()
      .post('/api/sessions')
      .send({ email: defaultUser.email, password: defaultUser.password });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USER_BANNED');
  });

  it('повертає 422 без пароля', async () => {
    const res = await agent().post('/api/sessions').send({ email: defaultUser.email });

    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/sessions', () => {
  it('очищає cookie', async () => {
    const res = await agent().delete('/api/sessions');

    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'].join(';')).toMatch(/token=;/);
  });
});
