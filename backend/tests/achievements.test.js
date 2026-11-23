jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const fakeDb = require('./helpers/fakeDb');
const { agent } = require('./helpers/app');
const { signedIn, team, upload } = require('./helpers/fixtures');
const achievementsService = require('../src/services/achievementsService');

beforeEach(() => {
  fakeDb.reset();
  jest.restoreAllMocks();
});

const achievementNotices = async (userId) =>
  (await fakeDb.notification.findMany({ where: { userId, type: 'ACHIEVEMENT' } }))
    .map((n) => n.data.code)
    .sort();

// Світлини напряму в базі: швидше, ніж завантажувати кожну через API
async function seedPhotos(authorId, count) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    list.push(
      await fakeDb.photo.create({
        data: {
          slug: `s${authorId}-${i}`,
          url: 'u',
          publicId: `p${authorId}-${i}`,
          description: 'd',
          authorId,
        },
      }),
    );
  }
  return list;
}

describe('публікації', () => {
  it('«Перша світлина» за першу публікацію, один раз, зі сповіщенням', async () => {
    const { owner } = await team();
    const first = await upload(owner.client);
    const second = await upload(owner.client);

    expect(first.body.newAchievements).toEqual(['FIRST_PHOTO']);
    expect(second.body.newAchievements).toEqual([]);
    expect(await achievementNotices(owner.user.id)).toEqual(['FIRST_PHOTO']);
  });

  it('«10 публікацій» на десятій світлині', async () => {
    const { owner } = await team();
    await upload(owner.client);
    await seedPhotos(owner.user.id, 8);
    const tenth = await upload(owner.client);
    expect(tenth.body.newAchievements).toEqual(['TEN_PHOTOS']);
  });
});

describe('коментарі', () => {
  it('«Коментатор» на двадцятому коментарі', async () => {
    const { owner, stranger } = await team();
    const { photo } = (await upload(owner.client)).body;
    const comment = () =>
      stranger.client.post(`/api/photos/${photo.id}/comments`).send({ text: 'Гарно' });

    for (let i = 1; i < 20; i += 1) {
      expect((await comment()).body.newAchievements).toEqual([]);
    }
    expect((await comment()).body.newAchievements).toEqual(['COMMENTATOR']);
    expect((await comment()).body.newAchievements).toEqual([]);
  });
});

describe('оцінки', () => {
  it('«Критик» на п’ятдесятій оцінці', async () => {
    const { owner, stranger } = await team();
    const photos = await seedPhotos(owner.user.id, 50);
    for (const photo of photos.slice(0, 49)) {
      await fakeDb.rating.create({
        data: { photoId: photo.id, userId: stranger.user.id, value: 3 },
      });
    }
    const res = await stranger.client
      .post(`/api/photos/${photos[49].id}/ratings`)
      .send({ value: 4 });
    expect(res.status).toBe(201);
    expect(res.body.newAchievements).toEqual(['CRITIC']);
  });

  async function ratedBy(values) {
    const owner = await signedIn('owner');
    const { photo } = (await upload(owner.client)).body;
    const responses = [];
    for (const [index, value] of values.entries()) {
      const voter = await signedIn(`voter${index}`);
      responses.push(await voter.client.post(`/api/photos/${photo.id}/ratings`).send({ value }));
    }
    return { owner, responses };
  }

  it('«Улюбленець» автору при середньому 4.5+ від 5 оцінок, лише сповіщенням', async () => {
    const { owner, responses } = await ratedBy([5, 5, 5, 4, 4]);
    expect(await achievementNotices(owner.user.id)).toEqual(['FAVORITE', 'FIRST_PHOTO']);
    // Тост показується тому, хто отримав; оцінювач «Улюбленця» не отримує
    expect(responses.at(-1).body.newAchievements).toEqual([]);
  });

  it('без «Улюбленця»: менше 5 оцінок або середнє нижче 4.5', async () => {
    const few = await ratedBy([5, 5, 5, 5]);
    expect(await achievementNotices(few.owner.user.id)).toEqual(['FIRST_PHOTO']);
    fakeDb.reset();
    const low = await ratedBy([5, 5, 4, 4, 4]);
    expect(await achievementNotices(low.owner.user.id)).toEqual(['FIRST_PHOTO']);
  });
});

describe('GET /api/users/:username/achievements', () => {
  it('усі п’ять у фіксованому порядку, отримані з датою, публічно', async () => {
    const { owner } = await team();
    await upload(owner.client);
    const res = await agent().get('/api/users/owner/achievements');

    expect(res.status).toBe(200);
    expect(res.body.items.map((a) => [a.code, a.earned])).toEqual([
      ['FIRST_PHOTO', true],
      ['TEN_PHOTOS', false],
      ['COMMENTATOR', false],
      ['CRITIC', false],
      ['FAVORITE', false],
    ]);
    expect(res.body.items[0].earnedAt).toEqual(expect.any(String));
    expect(res.body.items[1].earnedAt).toBeNull();
  });

  it('невідомий користувач - 404', async () => {
    expect((await agent().get('/api/users/nobody/achievements')).status).toBe(404);
  });
});

describe('надійність', () => {
  it('паралельна видача (P2002) не дає дубліката сповіщення', async () => {
    const { owner } = await team();
    await seedPhotos(owner.user.id, 1);
    jest
      .spyOn(fakeDb.userAchievement, 'create')
      .mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    expect(await achievementsService.check(owner.user.id, 'photo')).toEqual([]);
    expect(await achievementNotices(owner.user.id)).toEqual([]);
  });

  it('помилка перевірки не ламає публікацію', async () => {
    const { owner } = await team();
    jest.spyOn(fakeDb.userAchievement, 'findMany').mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await upload(owner.client);
    expect(res.status).toBe(201);
    expect(res.body.newAchievements).toEqual([]);
  });

  it('невідомий тригер нічого не перевіряє', async () => {
    expect(await achievementsService.check(1, 'unknown')).toEqual([]);
    expect(await achievementsService.check(null, 'photo')).toEqual([]);
  });
});
