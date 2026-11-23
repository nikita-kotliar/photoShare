jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const fakeDb = require('./helpers/fakeDb');
const { agent } = require('./helpers/app');
const { allRoles, upload } = require('./helpers/fixtures');
const notificationsService = require('../src/services/notificationsService');

beforeEach(() => {
  fakeDb.reset();
  jest.restoreAllMocks();
});

async function setup() {
  const people = await allRoles();
  const { photo } = (await upload(people.owner.client, 'Захід сонця')).body;
  // Перша публікація дає досягнення (TASK-070) і його сповіщення: тут воно лише заважає
  fakeDb.notification.clear();
  return { ...people, photo };
}

const list = (client, query = '') => client.get(`/api/notifications${query}`);
const unread = async (client) => (await client.get('/api/notifications/unread-count')).body.count;

describe('коли створюються сповіщення', () => {
  it('коментар до чужої світлини сповіщає автора світлини', async () => {
    const { owner, stranger, photo } = await setup();
    await stranger.client.post(`/api/photos/${photo.id}/comments`).send({ text: 'Чудово!' });

    const res = await list(owner.client);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, limit: 12, pages: 1 });
    expect(res.body.items[0]).toEqual({
      id: 1,
      type: 'COMMENT',
      read: false,
      actor: { id: stranger.user.id, username: 'stranger', name: 'stranger', avatarUrl: null },
      photo: { id: photo.id, slug: photo.slug, url: photo.url },
      data: { commentId: 1, text: 'Чудово!' },
      createdAt: expect.any(String),
    });
  });

  it('оцінка чужої світлини сповіщає автора з оцінкою', async () => {
    const { owner, stranger, photo } = await setup();
    await stranger.client.post(`/api/photos/${photo.id}/ratings`).send({ value: 5 });

    const [item] = (await list(owner.client)).body.items;
    expect(item).toMatchObject({ type: 'RATING', data: { value: 5 }, photo: { id: photo.id } });
  });

  it('призначення модератором сповіщає користувача, повторне - ні', async () => {
    const { admin, stranger } = await setup();
    const promote = () =>
      admin.client.patch(`/api/admin/users/${stranger.user.id}/role`).send({ role: 'MODERATOR' });
    await promote();
    await promote();

    const res = await list(stranger.client);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      type: 'MODERATOR',
      actor: { username: 'admin' },
      photo: null,
      data: {},
    });
  });

  it('зняття ролі модератора не сповіщає', async () => {
    const { admin, moderator } = await setup();
    await admin.client.patch(`/api/admin/users/${moderator.user.id}/role`).send({ role: 'USER' });
    expect(await unread(moderator.client)).toBe(0);
  });

  it('про власні дії не сповіщає', async () => {
    const { owner, photo } = await setup();
    await owner.client.post(`/api/photos/${photo.id}/comments`).send({ text: 'Мій коментар' });
    expect(await unread(owner.client)).toBe(0);
    expect(
      await notificationsService.notify({ userId: 5, actorId: 5, type: 'COMMENT' }),
    ).toBeNull();
  });

  it('досягнення - системне сповіщення без автора', async () => {
    const { owner } = await setup();
    await notificationsService.notify({
      userId: owner.user.id,
      type: 'ACHIEVEMENT',
      data: { code: 'FIRST_PHOTO' },
    });
    const [item] = (await list(owner.client)).body.items;
    expect(item).toMatchObject({ type: 'ACHIEVEMENT', actor: null, data: { code: 'FIRST_PHOTO' } });
  });

  it('помилка при створенні сповіщення не ламає коментар', async () => {
    const { stranger, photo } = await setup();
    jest.spyOn(fakeDb.notification, 'create').mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await stranger.client
      .post(`/api/photos/${photo.id}/comments`)
      .send({ text: 'Все одно збережеться' });
    expect(res.status).toBe(201);
  });

  it('видалення світлини видаляє і сповіщення про неї', async () => {
    const { owner, stranger, photo } = await setup();
    await stranger.client.post(`/api/photos/${photo.id}/comments`).send({ text: 'Ок' });
    await owner.client.delete(`/api/photos/${photo.id}`);
    expect((await list(owner.client)).body.total).toBe(0);
  });
});

describe('список, лічильник і прочитання', () => {
  async function withThree() {
    const people = await setup();
    const { stranger, moderator, photo } = people;
    await stranger.client.post(`/api/photos/${photo.id}/comments`).send({ text: 'Перший' });
    await stranger.client.post(`/api/photos/${photo.id}/ratings`).send({ value: 4 });
    await moderator.client.post(`/api/photos/${photo.id}/comments`).send({ text: 'Третій' });
    return people;
  }

  it('без входу 401', async () => {
    expect((await agent().get('/api/notifications')).status).toBe(401);
    expect((await agent().get('/api/notifications/unread-count')).status).toBe(401);
    expect((await agent().post('/api/notifications/read')).status).toBe(401);
  });

  it('нові першими, з пагінацією, лише свої', async () => {
    const { owner, stranger } = await withThree();
    const res = await list(owner.client, '?limit=2');
    expect(res.body).toMatchObject({ total: 3, pages: 2 });
    expect(res.body.items.map((n) => n.data.text ?? n.data.value)).toEqual(['Третій', 4]);
    expect((await list(stranger.client)).body.total).toBe(0);
  });

  it('позначає прочитаними вибрані, а потім усі', async () => {
    const { owner } = await withThree();
    expect(await unread(owner.client)).toBe(3);

    const one = await owner.client.post('/api/notifications/read').send({ ids: [1] });
    expect(one.body).toEqual({ updated: 1, unread: 2 });
    expect((await list(owner.client)).body.items.at(-1).read).toBe(true);

    const all = await owner.client.post('/api/notifications/read').send({});
    expect(all.body).toEqual({ updated: 2, unread: 0 });
  });

  it('чужі сповіщення прочитати не можна', async () => {
    const { owner, stranger } = await withThree();
    const res = await stranger.client.post('/api/notifications/read').send({ ids: [1, 2, 3] });
    expect(res.body).toEqual({ updated: 0, unread: 0 });
    expect(await unread(owner.client)).toBe(3);
  });

  it('некоректні ids - 422', async () => {
    const { owner } = await setup();
    for (const ids of [[], ['1'], [0], 'all', Array.from({ length: 101 }, (_, i) => i + 1)]) {
      const res = await owner.client.post('/api/notifications/read').send({ ids });
      expect(res.status).toBe(422);
    }
  });
});
