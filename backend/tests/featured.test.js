jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const fakeDb = require('./helpers/fakeDb');
const { agent } = require('./helpers/app');
const { signedIn, upload } = require('./helpers/fixtures');

beforeEach(() => {
  fakeDb.reset();
});

async function people(count) {
  const list = [];
  for (let i = 1; i <= count; i += 1) list.push(await signedIn(`voter${i}`));
  return list;
}

async function rateAll(voters, photo, values) {
  for (const [i, value] of values.entries()) {
    await voters[i].client.post(`/api/photos/${photo.id}/ratings`).send({ value });
  }
}

async function setup() {
  const owner = await signedIn('owner');
  const voters = await people(4);
  const photo = async (description) => (await upload(owner.client, description)).body.photo;
  return { owner, voters, photo };
}

function featured(client = agent()) {
  return client.get('/api/photos/featured');
}

describe('GET /api/photos/featured', () => {
  it('без оцінок за тиждень: photo null', async () => {
    const { photo } = await setup();
    await photo('Без оцінок');

    const res = await featured();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ photo: null });
  });

  it('найвищий середній рейтинг за 7 днів, від 2 оцінок; доступно гостю', async () => {
    const { voters, photo } = await setup();
    const good = await photo('Добра');
    const best = await photo('Найкраща');
    const single = await photo('Одна п’ятірка');
    await rateAll(voters, good, [4, 4, 5]);
    await rateAll(voters, best, [5, 5]);
    await rateAll(voters, single, [5]);

    const res = await featured();

    expect(res.body.photo).toMatchObject({
      id: best.id,
      description: 'Найкраща',
      averageRating: 5,
      ratingsCount: 2,
      myRating: null,
      author: { username: 'owner' },
    });
  });

  it('при однаковому середньому вища та, де більше оцінок', async () => {
    const { voters, photo } = await setup();
    const fewer = await photo('Менше');
    const more = await photo('Більше');
    await rateAll(voters, fewer, [4, 4]);
    await rateAll(voters, more, [4, 4, 4, 4]);

    expect((await featured()).body.photo.id).toBe(more.id);
  });

  it('світлини, старші за тиждень, не враховуються', async () => {
    const { voters, photo } = await setup();
    const old = await photo('Стара');
    const fresh = await photo('Свіжа');
    await rateAll(voters, old, [5, 5, 5]);
    await rateAll(voters, fresh, [3, 3]);
    await fakeDb.photo.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });

    expect((await featured()).body.photo.id).toBe(fresh.id);
  });

  it('з сесією показує мою оцінку; маршрут не плутається зі slug', async () => {
    const { voters, photo } = await setup();
    const one = await photo('Одна');
    await rateAll(voters, one, [5, 3]);

    const res = await featured(voters[1].client);

    expect(res.body.photo).toMatchObject({ id: one.id, averageRating: 4, myRating: 3 });
  });
});
