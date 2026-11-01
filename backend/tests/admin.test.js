jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const fakeDb = require('./helpers/fakeDb');
const { agent, defaultUser } = require('./helpers/app');
const { signedIn, team } = require('./helpers/fixtures');

beforeEach(() => {
  fakeDb.reset();
});

async function setUser(id, data) {
  await fakeDb.user.update({ where: { id }, data });
}

async function withModerator() {
  const members = await team();
  await setUser(members.stranger.user.id, { role: 'MODERATOR' });
  return { ...members, moderator: members.stranger };
}

function setStatus(client, id, isActive) {
  return client.patch(`/api/admin/users/${id}/status`).send({ isActive });
}

describe('GET /api/admin/users', () => {
  it('без авторизації 401, звичайний користувач 403', async () => {
    const { owner } = await team();
    const guest = await agent().get('/api/admin/users');
    const user = await owner.client.get('/api/admin/users');

    expect(guest.status).toBe(401);
    expect(user.status).toBe(403);
  });

  it('ADMIN і MODERATOR бачать пагінований список, нові першими', async () => {
    const { admin, moderator } = await withModerator();
    const byAdmin = await admin.client.get('/api/admin/users');
    const byModerator = await moderator.client.get('/api/admin/users?limit=2&page=2');

    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body).toMatchObject({ total: 3, page: 1, limit: 12, pages: 1 });
    expect(byAdmin.body.items.map((u) => u.username)).toEqual(['stranger', 'owner', 'admin']);
    expect(byAdmin.body.items[0]).toEqual({
      id: 3,
      username: 'stranger',
      name: 'stranger',
      email: 'stranger@example.com',
      role: 'MODERATOR',
      isActive: true,
      avatarUrl: null,
      createdAt: expect.any(String),
    });
    expect(byModerator.status).toBe(200);
    expect(byModerator.body.items.map((u) => u.username)).toEqual(['admin']);
  });

  it('шукає за іменем, юзернеймом і email без урахування регістру', async () => {
    const { admin } = await team();
    await setUser(2, { name: 'Олена Коваль' });

    const byName = await admin.client.get('/api/admin/users').query({ q: 'олена' });
    const byEmail = await admin.client.get('/api/admin/users').query({ q: 'STRANGER@' });
    const none = await admin.client.get('/api/admin/users').query({ q: 'nobody' });

    expect(byName.body.items.map((u) => u.id)).toEqual([2]);
    expect(byEmail.body.items.map((u) => u.id)).toEqual([3]);
    expect(none.body).toMatchObject({ items: [], total: 0 });
  });

  it('фільтрує за роллю', async () => {
    const { admin } = await withModerator();
    const res = await admin.client.get('/api/admin/users').query({ role: 'MODERATOR' });

    expect(res.body.items.map((u) => u.username)).toEqual(['stranger']);
    expect(res.body.total).toBe(1);
  });

  it('фільтрує за датою реєстрації включно з обома днями', async () => {
    const { admin } = await team();
    await setUser(1, { createdAt: new Date('2026-09-30T23:59:59Z') });
    await setUser(2, { createdAt: new Date('2026-10-01T00:00:00Z') });
    await setUser(3, { createdAt: new Date('2026-10-15T23:59:59Z') });

    const from = await admin.client.get('/api/admin/users').query({ registeredFrom: '2026-10-01' });
    const range = await admin.client
      .get('/api/admin/users')
      .query({ registeredFrom: '2026-10-01', registeredTo: '2026-10-01' });
    const to = await admin.client.get('/api/admin/users').query({ registeredTo: '2026-10-15' });

    expect(from.body.items.map((u) => u.id)).toEqual([3, 2]);
    expect(range.body.items.map((u) => u.id)).toEqual([2]);
    expect(to.body.total).toBe(3);
  });

  it('фільтри поєднуються', async () => {
    const { admin } = await withModerator();
    const res = await admin.client.get('/api/admin/users').query({ q: 'owner', role: 'MODERATOR' });

    expect(res.body).toMatchObject({ items: [], total: 0 });
  });

  it('некоректні фільтри повертають 422', async () => {
    const { admin } = await team();
    const cases = [
      [{ role: 'ROOT' }, 'role'],
      [{ registeredFrom: '01.10.2026' }, 'registeredFrom'],
      [{ registeredTo: '2026-13-01' }, 'registeredTo'],
      [{ registeredFrom: '2026-10-02', registeredTo: '2026-10-01' }, 'registeredTo'],
      [{ q: 'a'.repeat(101) }, 'q'],
      [{ limit: 51 }, 'limit'],
    ];

    for (const [query, field] of cases) {
      const res = await admin.client.get('/api/admin/users').query(query);
      expect(res.status).toBe(422);
      expect(res.body.error.fields[field]).toBeDefined();
    }
  });
});

describe('PATCH /api/admin/users/:id/status', () => {
  it('ADMIN банить і розбанює користувача', async () => {
    const { admin, owner } = await team();
    const banned = await setStatus(admin.client, owner.user.id, false);
    const restored = await setStatus(admin.client, owner.user.id, true);

    expect(banned.status).toBe(200);
    expect(banned.body.user).toMatchObject({ id: owner.user.id, isActive: false });
    expect(restored.body.user.isActive).toBe(true);
  });

  it('забанений не може увійти, а його сесія перестає працювати', async () => {
    const { admin } = await team();
    const target = await signedIn('target');
    await setStatus(admin.client, target.user.id, false);

    const session = await target.client.get('/api/users/me');
    const login = await agent()
      .post('/api/sessions')
      .send({ email: 'target@example.com', password: defaultUser.password });

    expect(session.status).toBe(403);
    expect(session.body.error.code).toBe('USER_BANNED');
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('USER_BANNED');
  });

  it('після розбану користувач знову входить', async () => {
    const { admin } = await team();
    const target = await signedIn('target');
    await setStatus(admin.client, target.user.id, false);
    await setStatus(admin.client, target.user.id, true);

    const login = await agent()
      .post('/api/sessions')
      .send({ email: 'target@example.com', password: defaultUser.password });

    expect(login.status).toBe(200);
  });

  it('MODERATOR і звичайний користувач банити не можуть', async () => {
    const { owner, moderator } = await withModerator();
    const byModerator = await setStatus(moderator.client, owner.user.id, false);
    const byUser = await setStatus(owner.client, moderator.user.id, false);

    expect(byModerator.status).toBe(403);
    expect(byUser.status).toBe(403);
    expect((await fakeDb.user.findUnique({ where: { id: owner.user.id } })).isActive).toBe(true);
  });

  it('не можна забанити себе чи іншого ADMIN', async () => {
    const { admin, owner } = await team();
    await setUser(owner.user.id, { role: 'ADMIN' });

    const self = await setStatus(admin.client, admin.user.id, false);
    const otherAdmin = await setStatus(admin.client, owner.user.id, false);

    expect(self.status).toBe(403);
    expect(otherAdmin.status).toBe(403);
    expect((await fakeDb.user.findUnique({ where: { id: owner.user.id } })).isActive).toBe(true);
  });

  it('неіснуючий користувач 404, некоректні дані 422', async () => {
    const { admin, owner } = await team();
    const missing = await setStatus(admin.client, 999, false);
    const badId = await setStatus(admin.client, 'abc', false);
    const badBody = await setStatus(admin.client, owner.user.id, 'false');
    const noBody = await admin.client.patch(`/api/admin/users/${owner.user.id}/status`).send({});

    expect(missing.status).toBe(404);
    expect(badId.status).toBe(422);
    expect(badBody.status).toBe(422);
    expect(badBody.body.error.fields.isActive).toBeDefined();
    expect(noBody.status).toBe(422);
  });
});
