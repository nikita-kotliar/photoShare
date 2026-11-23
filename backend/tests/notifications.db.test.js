// Сповіщення на справжньому PostgreSQL (TASK-068): Json-поле data, каскади і SET NULL
// з міграції. Запуск: TEST_DATABASE_URL, як у search.db.test.js

const db = require('../src/config/db');
const notificationsService = require('../src/services/notificationsService');

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb('notifications на PostgreSQL', () => {
  let owner;
  let actor;
  let photo;

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE users, photos, tags, photo_tags, comments, transformed_links, ratings, token_blacklist, notifications RESTART IDENTITY CASCADE',
    );
    const make = (username) =>
      db.user.create({
        data: { username, email: `${username}@example.com`, name: username, passwordHash: '-' },
      });
    owner = await make('owner');
    actor = await make('actor');
    photo = await db.photo.create({
      data: {
        slug: 'slug1',
        url: 'https://example.com/1.png',
        publicId: 'p/1',
        description: 'Опис',
        authorId: owner.id,
      },
    });
  });

  afterAll(async () => {
    await db.$executeRawUnsafe('TRUNCATE users, notifications RESTART IDENTITY CASCADE');
    await db.$disconnect();
  });

  it('зберігає data як JSON і без data', async () => {
    await notificationsService.notify({
      userId: owner.id,
      type: 'RATING',
      actorId: actor.id,
      photoId: photo.id,
      data: { value: 5 },
    });
    await notificationsService.notify({ userId: owner.id, type: 'MODERATOR', actorId: actor.id });

    const { items, total } = await notificationsService.list(owner, { page: 1, limit: 10 });
    expect(total).toBe(2);
    expect(items.map((n) => [n.type, n.data])).toEqual([
      ['MODERATOR', null],
      ['RATING', { value: 5 }],
    ]);
    expect(items[1].photo).toMatchObject({ id: photo.id, slug: 'slug1' });
    expect(items[1].actor).toMatchObject({ username: 'actor' });
  });

  it('лічильник і прочитання на рівні бази', async () => {
    for (let i = 0; i < 3; i += 1) {
      await notificationsService.notify({ userId: owner.id, type: 'COMMENT', actorId: actor.id });
    }
    expect(await notificationsService.unreadCount(owner)).toBe(3);
    expect(await notificationsService.markRead(owner, { ids: [1, 2] })).toEqual({
      updated: 2,
      unread: 1,
    });
    expect(await notificationsService.markRead(owner)).toEqual({ updated: 1, unread: 0 });
  });

  it('видалення світлини видаляє сповіщення про неї (CASCADE)', async () => {
    await notificationsService.notify({
      userId: owner.id,
      type: 'COMMENT',
      actorId: actor.id,
      photoId: photo.id,
    });
    await db.photo.delete({ where: { id: photo.id } });
    expect(await db.notification.count()).toBe(0);
  });

  it('невідомий тип база не приймає, а notify лише логує помилку', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await notificationsService.notify({ userId: owner.id, type: 'SPAM' })).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
