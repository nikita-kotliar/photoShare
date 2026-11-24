jest.mock('../src/config/db', () => require('./helpers/fakeDb'));
jest.mock('../src/services/mailService', () => ({ send: jest.fn(async () => true) }));

const fakeDb = require('./helpers/fakeDb');
const mailService = require('../src/services/mailService');
const { agent, register, defaultUser } = require('./helpers/app');
const { escapeHtml, TOKEN_TTL_MS } = require('../src/services/passwordService');

beforeEach(() => {
  fakeDb.reset();
  jest.clearAllMocks();
});

async function owner() {
  const client = agent();
  const { body } = await register(client, { username: 'owner', email: 'owner@example.com' });
  return { client, user: body.user };
}

function forgot(email) {
  return agent().post('/api/password/forgot').send({ email });
}

function tokenFromMail() {
  const { text } = mailService.send.mock.calls.at(-1)[0];
  return text.match(/token=([0-9a-f]{64})/)[1];
}

function resetWith(token, password = 'new-password-1', client = agent()) {
  return client.post('/api/password/reset').send({ token, password });
}

function login(password) {
  return agent().post('/api/sessions').send({ email: 'owner@example.com', password });
}

describe('POST /api/password/forgot', () => {
  it('надсилає лист з одноразовим посиланням на сайт', async () => {
    await owner();
    const res = await forgot('Owner@Example.com');

    expect(res.status).toBe(200);
    expect(mailService.send).toHaveBeenCalledTimes(1);
    const mail = mailService.send.mock.calls[0][0];
    expect(mail.to).toBe('owner@example.com');
    expect(mail.text).toMatch(/http:\/\/localhost:5173\/reset-password\?token=[0-9a-f]{64}/);
    const saved = await fakeDb.passwordReset.count({ where: { usedAt: null } });
    expect(saved).toBe(1);
  });

  it('у базі лише хеш токена, а не сам токен', async () => {
    await owner();
    await forgot('owner@example.com');
    const token = tokenFromMail();

    expect(await fakeDb.passwordReset.findUnique({ where: { tokenHash: token } })).toBeNull();
  });

  it('невідома пошта: та сама відповідь 200, лист не надсилається', async () => {
    await owner();
    const known = await forgot('owner@example.com');
    const unknown = await forgot('nobody@example.com');

    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(mailService.send).toHaveBeenCalledTimes(1);
  });

  it('забаненому лист не надсилається', async () => {
    const { user } = await owner();
    await fakeDb.user.update({ where: { id: user.id }, data: { isActive: false } });
    await forgot('owner@example.com');

    expect(mailService.send).not.toHaveBeenCalled();
  });

  it('новий запит скасовує попереднє посилання', async () => {
    await owner();
    await forgot('owner@example.com');
    const first = tokenFromMail();
    await forgot('owner@example.com');

    expect((await resetWith(first)).status).toBe(422);
    expect((await resetWith(tokenFromMail())).status).toBe(200);
  });

  it('некоректна пошта 422; шостий запит за годину 429', async () => {
    expect((await forgot('not-an-email')).status).toBe(422);
    for (let i = 0; i < 4; i += 1) await forgot('x@example.com');
    expect((await forgot('x@example.com')).status).toBe(429);
  });

  it('збій пошти не видає, чи існує акаунт', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await owner();
    mailService.send.mockRejectedValueOnce(new Error('SMTP down'));

    const res = await forgot('owner@example.com');

    expect(res.status).toBe(200);
  });
});

describe('POST /api/password/reset', () => {
  it('новий пароль працює, старий ні; одразу вхід з cookie', async () => {
    await owner();
    await forgot('owner@example.com');
    const client = agent();
    const res = await resetWith(tokenFromMail(), 'new-password-1', client);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('owner');
    expect((await client.get('/api/users/me')).status).toBe(200);
    expect((await login('new-password-1')).status).toBe(200);
    expect((await login(defaultUser.password)).status).toBe(401);
  });

  it('посилання одноразове', async () => {
    await owner();
    await forgot('owner@example.com');
    const token = tokenFromMail();
    await resetWith(token);
    const again = await resetWith(token, 'another-pass-2');

    expect(again.status).toBe(422);
    expect(again.body.error.fields.token).toBeDefined();
  });

  it('прострочене посилання 422', async () => {
    jest.useFakeTimers({ now: Date.now(), doNotFake: ['nextTick', 'setImmediate'] });
    await owner();
    await forgot('owner@example.com');
    const token = tokenFromMail();
    jest.setSystemTime(Date.now() + TOKEN_TTL_MS + 1000);

    const res = await resetWith(token);
    jest.useRealTimers();

    expect(res.status).toBe(422);
  });

  it('вигаданий або некоректний токен і короткий пароль - 422', async () => {
    await owner();
    expect((await resetWith('a'.repeat(64))).status).toBe(422);
    expect((await resetWith('not-a-token')).status).toBe(422);

    await forgot('owner@example.com');
    const short = await resetWith(tokenFromMail(), '123');
    expect(short.status).toBe(422);
    expect(short.body.error.fields.password).toBeDefined();
  });

  it('акаунт лише з Google отримує пароль і може входити ним', async () => {
    const { user } = await owner();
    await fakeDb.user.update({
      where: { id: user.id },
      data: { passwordHash: null, googleId: 'g-1' },
    });
    await forgot('owner@example.com');
    await resetWith(tokenFromMail(), 'from-google-1');

    expect((await login('from-google-1')).status).toBe(200);
  });
});

describe('лист', () => {
  it('ім’я в HTML-версії екранується', () => {
    expect(escapeHtml('<b>"x"</b>')).toBe('&#60;b&#62;&#34;x&#34;&#60;/b&#62;');
  });
});
