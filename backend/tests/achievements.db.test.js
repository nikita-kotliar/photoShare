// Досягнення на справжньому PostgreSQL (TASK-070): UQ (user_id, code), enum і каскад.
// Запуск: TEST_DATABASE_URL, як у search.db.test.js

const db = require('../src/config/db');
const achievementsService = require('../src/services/achievementsService');

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb('user_achievements на PostgreSQL', () => {
  let user;

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE users, photos, tags, photo_tags, comments, transformed_links, ratings, token_blacklist, notifications, user_achievements RESTART IDENTITY CASCADE',
    );
    user = await db.user.create({
      data: { username: 'owner', email: 'owner@example.com', name: 'owner', passwordHash: '-' },
    });
  });

  afterAll(async () => {
    await db.$executeRawUnsafe('TRUNCATE users, user_achievements RESTART IDENTITY CASCADE');
    await db.$disconnect();
  });

  async function photo(authorId, n) {
    return db.photo.create({
      data: { slug: `s${n}`, url: 'u', publicId: `p${n}`, description: 'd', authorId },
    });
  }

  it('видає «Перша світлина» один раз і створює сповіщення', async () => {
    await photo(user.id, 1);
    expect(await achievementsService.check(user.id, 'photo')).toEqual(['FIRST_PHOTO']);
    expect(await achievementsService.check(user.id, 'photo')).toEqual([]);
    expect(await db.userAchievement.count()).toBe(1);
    const notice = await db.notification.findFirst({ where: { userId: user.id } });
    expect(notice).toMatchObject({ type: 'ACHIEVEMENT', data: { code: 'FIRST_PHOTO' } });
  });

  it('база не дає те саме досягнення двічі (UQ)', async () => {
    await db.userAchievement.create({ data: { userId: user.id, code: 'CRITIC' } });
    await expect(
      db.userAchievement.create({ data: { userId: user.id, code: 'CRITIC' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('паралельні перевірки видають досягнення лише один раз', async () => {
    await photo(user.id, 1);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => achievementsService.check(user.id, 'photo')),
    );
    expect(results.flat()).toEqual(['FIRST_PHOTO']);
    expect(await db.notification.count({ where: { type: 'ACHIEVEMENT' } })).toBe(1);
  });

  it('середній рейтинг від усіх світлин автора', async () => {
    const voter = await db.user.create({
      data: { username: 'v', email: 'v@example.com', name: 'v', passwordHash: '-' },
    });
    const a = await photo(user.id, 1);
    const b = await photo(user.id, 2);
    await db.rating.create({ data: { photoId: a.id, userId: voter.id, value: 5 } });
    await db.rating.create({ data: { photoId: b.id, userId: voter.id, value: 4 } });
    expect(await achievementsService.receivedRatings(user.id)).toEqual({ average: 4.5, count: 2 });
  });
});
