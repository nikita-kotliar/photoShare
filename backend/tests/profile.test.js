jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const fakeDb = require('./helpers/fakeDb');
const { agent, defaultUser } = require('./helpers/app');
const { ban, signedIn, team, upload } = require('./helpers/fixtures');

beforeEach(() => {
  fakeDb.reset();
});

function login(email, password = defaultUser.password) {
  return agent().post('/api/sessions').send({ email, password });
}

describe('профіль після редагування', () => {
  it('після зміни email вхід працює з новим email, зі старим ні', async () => {
    const { client } = await signedIn('owner');
    await client.put('/api/users/me').send({ email: 'new@example.com' }).expect(200);

    expect((await login('new@example.com')).status).toBe(200);
    expect((await login('owner@example.com')).status).toBe(401);
  });

  it('після зміни юзернейму сесія лишається, а світлини показують новий юзернейм', async () => {
    const { client } = await signedIn('owner');
    const { photo } = (await upload(client)).body;
    await client.put('/api/users/me').send({ username: 'renamed' }).expect(200);

    const me = await client.get('/api/users/me');
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('renamed');

    const one = await agent().get(`/api/photos/${photo.slug}`);
    expect(one.body.photo.author.username).toBe('renamed');

    const list = await agent().get('/api/users/renamed/photos');
    expect(list.body.total).toBe(1);
  });

  it('зайнятий email в іншому регістрі теж дає 409', async () => {
    const { owner } = await team();
    const res = await owner.client.put('/api/users/me').send({ email: 'STRANGER@Example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.fields.email).toBeDefined();
  });

  it('порожнє тіло дає 422', async () => {
    const { client } = await signedIn('owner');
    const res = await client.put('/api/users/me').send({});

    expect(res.status).toBe(422);
  });
});

describe('редагування без права', () => {
  it('забанений користувач не може змінити профіль', async () => {
    const owner = await signedIn('owner');
    await ban(owner);

    const res = await owner.client.put('/api/users/me').send({ name: 'Змінено' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USER_BANNED');

    const profile = await agent().get('/api/users/owner');
    expect(profile.body.user.name).toBe('owner');
  });

  it('після виходу старою сесією профіль не змінити', async () => {
    const { client } = await signedIn('owner');
    await client.delete('/api/sessions').expect(204);

    const res = await client.put('/api/users/me').send({ name: 'Змінено' });
    expect(res.status).toBe(401);
  });
});

describe('світлини в профілі', () => {
  it('нові першими, з автором', async () => {
    const { client } = await signedIn('owner');
    await upload(client, 'Перша');
    await upload(client, 'Друга');

    const res = await agent().get('/api/users/owner/photos');

    expect(res.body.items.map((p) => p.description)).toEqual(['Друга', 'Перша']);
    expect(res.body.items[0].author).toMatchObject({ username: 'owner' });
  });

  it('сторінка за межами списку порожня, ліміт понад 50 дає 422', async () => {
    const { client } = await signedIn('owner');
    await upload(client);

    const far = await agent().get('/api/users/owner/photos?page=5&limit=1');
    expect(far.body).toMatchObject({ items: [], total: 1, page: 5, pages: 1 });

    const big = await agent().get('/api/users/owner/photos?limit=51');
    expect(big.status).toBe(422);
  });

  it('photosCount рахує лише свої світлини і зменшується після видалення', async () => {
    const { owner, stranger } = await team();
    const client = owner.client;
    const { photo } = (await upload(client)).body;
    await upload(client);
    await upload(stranger.client);

    await client.delete(`/api/photos/${photo.id}`).expect(204);

    const res = await agent().get('/api/users/owner');
    expect(res.body.user.photosCount).toBe(1);
  });
});
