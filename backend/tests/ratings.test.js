jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const fakeDb = require('./helpers/fakeDb');
const { agent } = require('./helpers/app');
const { allRoles, ban, signedIn, upload } = require('./helpers/fixtures');
const { roundAverage } = require('../src/services/ratingsService');
const { COOKIE_NAME } = require('../src/utils/cookies');

beforeEach(() => {
  fakeDb.reset();
  jest.clearAllMocks();
});

async function setup() {
  const people = await allRoles();
  const { photo } = (await upload(people.owner.client)).body;
  return { ...people, photo };
}

function rate(client, photoId, value) {
  return client.post(`/api/photos/${photoId}/ratings`).send({ value });
}

// Ще кілька користувачів, щоб перевірити середнє
async function voters(count) {
  const list = [];
  for (let i = 1; i <= count; i += 1) list.push(await signedIn(`voter${i}`));
  return list;
}

describe('POST /api/photos/:id/ratings', () => {
  it('користувач оцінює чужу світлину і отримує новий рейтинг', async () => {
    const { stranger, photo } = await setup();
    const res = await rate(stranger.client, photo.id, 4);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      rating: {
        id: 1,
        photoId: photo.id,
        value: 4,
        user: { id: stranger.user.id, username: 'stranger', name: 'stranger', avatarUrl: null },
        createdAt: expect.any(String),
      },
      averageRating: 4,
      ratingsCount: 1,
    });
  });

  it('повторна оцінка тієї самої світлини дає 409 і не змінює рейтинг', async () => {
    const { stranger, photo } = await setup();
    await rate(stranger.client, photo.id, 5);
    const res = await rate(stranger.client, photo.id, 1);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'CONFLICT',
      message: 'Ви вже оцінили цю світлину',
    });
    const { body } = await agent().get(`/api/photos/${photo.id}`);
    expect(body.photo).toMatchObject({ averageRating: 5, ratingsCount: 1 });
  });

  it('одночасні запити: другий упирається в унікальний індекс і теж дає 409', async () => {
    const { stranger, photo } = await setup();
    await rate(stranger.client, photo.id, 5);
    // Перевірка вже пройшла (оцінки "ще немає"), а запис падає на UQ (photo_id, user_id)
    jest.spyOn(fakeDb.rating, 'findUnique').mockResolvedValueOnce(null);
    const res = await rate(stranger.client, photo.id, 3);

    expect(res.status).toBe(409);
    expect(await fakeDb.rating.count({ where: { photoId: photo.id } })).toBe(1);
  });

  it('власну світлину оцінити не можна, навіть адміну', async () => {
    const { owner, admin, photo } = await setup();
    const own = await rate(owner.client, photo.id, 5);
    expect(own.status).toBe(403);
    expect(own.body.error).toMatchObject({
      code: 'FORBIDDEN',
      message: 'Не можна оцінювати власні світлини',
    });

    const { photo: adminPhoto } = (await upload(admin.client)).body;
    expect((await rate(admin.client, adminPhoto.id, 5)).status).toBe(403);
    expect(await fakeDb.rating.count()).toBe(0);
  });

  it.each([[0], [6], [3.5], ['5'], [null], [undefined]])('значення %p дає 422', async (value) => {
    const { stranger, photo } = await setup();
    const res = await rate(stranger.client, photo.id, value);

    expect(res.status).toBe(422);
    expect(res.body.error.fields.value).toBeDefined();
  });

  it('без авторизації 401, забанений 403, неіснуюча світлина 404', async () => {
    const { stranger, photo } = await setup();
    expect((await rate(agent(), photo.id, 5)).status).toBe(401);
    expect((await rate(stranger.client, 999, 5)).status).toBe(404);

    await ban(stranger);
    const banned = await rate(stranger.client, photo.id, 5);
    expect(banned.status).toBe(403);
    expect(banned.body.error.code).toBe('USER_BANNED');
  });
});

describe('середній рейтинг', () => {
  it('рахується як середнє всіх оцінок з одним знаком після коми', async () => {
    const { photo } = await setup();
    const [a, b, c] = await voters(3);
    await rate(a.client, photo.id, 5);
    await rate(b.client, photo.id, 4);
    const res = await rate(c.client, photo.id, 4);

    expect(res.body).toMatchObject({ averageRating: 4.3, ratingsCount: 3 });
  });

  it('roundAverage округлює до одного знака, без оцінок null', () => {
    expect(roundAverage(13 / 3)).toBe(4.3);
    expect(roundAverage(1.5)).toBe(1.5);
    expect(roundAverage(4.25)).toBe(4.3);
    expect(roundAverage(2)).toBe(2);
    expect(roundAverage(null)).toBeNull();
  });

  it('світлина без оцінок: averageRating null і ratingsCount 0', async () => {
    const { photo } = await setup();
    const { body } = await agent().get(`/api/photos/${photo.id}`);
    expect(body.photo).toMatchObject({ averageRating: null, ratingsCount: 0, myRating: null });
  });

  it('у світлині, стрічці і профілі той самий рейтинг; myRating лише для того, хто оцінив', async () => {
    const { owner, stranger, moderator, photo } = await setup();
    await upload(owner.client, 'Без оцінок');
    await rate(stranger.client, photo.id, 2);
    await rate(moderator.client, photo.id, 5);

    const mine = await stranger.client.get(`/api/photos/${photo.slug}`);
    expect(mine.body.photo).toMatchObject({ averageRating: 3.5, ratingsCount: 2, myRating: 2 });

    const guest = await agent().get(`/api/photos/${photo.id}`);
    expect(guest.body.photo).toMatchObject({ averageRating: 3.5, myRating: null });

    const author = await owner.client.get(`/api/photos/${photo.id}`);
    expect(author.body.photo.myRating).toBeNull();

    const feed = await moderator.client.get('/api/photos');
    const rated = feed.body.items.find((item) => item.id === photo.id);
    const unrated = feed.body.items.find((item) => item.id !== photo.id);
    expect(rated).toMatchObject({ averageRating: 3.5, ratingsCount: 2, myRating: 5 });
    expect(unrated).toMatchObject({ averageRating: null, ratingsCount: 0, myRating: null });

    const profile = await stranger.client.get('/api/users/owner/photos');
    expect(profile.body.items.find((item) => item.id === photo.id)).toMatchObject({
      averageRating: 3.5,
      myRating: 2,
    });
  });

  it('недійсна cookie на публічній сторінці світлини не ламає запит: гість', async () => {
    const { photo } = await setup();
    const res = await agent()
      .get(`/api/photos/${photo.id}`)
      .set('Cookie', `${COOKIE_NAME}=not-a-jwt`);

    expect(res.status).toBe(200);
    expect(res.body.photo.myRating).toBeNull();
  });

  it('забанений з валідною сесією бачить публічну світлину як гість', async () => {
    const { stranger, photo } = await setup();
    await rate(stranger.client, photo.id, 4);
    await ban(stranger);
    const res = await stranger.client.get(`/api/photos/${photo.id}`);

    expect(res.status).toBe(200);
    expect(res.body.photo).toMatchObject({ averageRating: 4, myRating: null });
  });
});

describe('GET /api/photos/:id/ratings', () => {
  it('MODERATOR і ADMIN бачать пагінований список, нові першими', async () => {
    const { admin, moderator, stranger, photo } = await setup();
    await rate(stranger.client, photo.id, 3);
    await rate(moderator.client, photo.id, 5);

    for (const staff of [admin, moderator]) {
      const res = await staff.client.get(`/api/photos/${photo.id}/ratings?limit=1`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, limit: 1, pages: 2 });
      expect(res.body.items).toEqual([
        expect.objectContaining({
          value: 5,
          user: expect.objectContaining({ username: 'moderator' }),
        }),
      ]);
    }
  });

  it('звичайний користувач 403, гість 401, неіснуюча світлина 404', async () => {
    const { admin, stranger, photo } = await setup();
    expect((await stranger.client.get(`/api/photos/${photo.id}/ratings`)).status).toBe(403);
    expect((await agent().get(`/api/photos/${photo.id}/ratings`)).status).toBe(401);
    expect((await admin.client.get('/api/photos/999/ratings')).status).toBe(404);
  });
});

describe('DELETE /api/ratings/:id', () => {
  it('MODERATOR видаляє оцінку, рейтинг перераховується, користувач може оцінити знову', async () => {
    const { moderator, stranger, admin, photo } = await setup();
    const { body } = await rate(stranger.client, photo.id, 1);
    await rate(admin.client, photo.id, 5);

    const res = await moderator.client.delete(`/api/ratings/${body.rating.id}`);
    expect(res.status).toBe(204);

    const after = await agent().get(`/api/photos/${photo.id}`);
    expect(after.body.photo).toMatchObject({ averageRating: 5, ratingsCount: 1 });
    expect((await rate(stranger.client, photo.id, 4)).status).toBe(201);
  });

  it('ADMIN теж може видалити оцінку', async () => {
    const { admin, stranger, photo } = await setup();
    const { body } = await rate(stranger.client, photo.id, 2);
    expect((await admin.client.delete(`/api/ratings/${body.rating.id}`)).status).toBe(204);
  });

  it('автор оцінки-USER видалити її не може (403), гість 401, неіснуюча 404', async () => {
    const { admin, stranger, photo } = await setup();
    const { body } = await rate(stranger.client, photo.id, 2);

    expect((await stranger.client.delete(`/api/ratings/${body.rating.id}`)).status).toBe(403);
    expect((await agent().delete(`/api/ratings/${body.rating.id}`)).status).toBe(401);
    expect((await admin.client.delete('/api/ratings/999')).status).toBe(404);
    expect(await fakeDb.rating.count()).toBe(1);
  });
});

describe('видалення світлини', () => {
  it('прибирає її оцінки', async () => {
    const { owner, stranger, photo } = await setup();
    await rate(stranger.client, photo.id, 4);
    await owner.client.delete(`/api/photos/${photo.id}`);

    expect(await fakeDb.rating.count()).toBe(0);
  });
});
