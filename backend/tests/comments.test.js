jest.mock('../src/config/db', () => require('./helpers/fakeDb'));
jest.mock('../src/services/cloudinaryService', () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
}));

const fakeDb = require('./helpers/fakeDb');
const cloudinaryService = require('../src/services/cloudinaryService');
const { agent } = require('./helpers/app');
const { mockCloudinary, signedIn, team, upload } = require('./helpers/fixtures');

beforeEach(() => {
  fakeDb.reset();
  jest.clearAllMocks();
  mockCloudinary(cloudinaryService);
});

async function setup() {
  const people = await team();
  const moderator = await signedIn('moderator');
  await fakeDb.user.update({ where: { id: moderator.user.id }, data: { role: 'MODERATOR' } });
  const { photo } = (await upload(people.owner.client)).body;
  return { ...people, moderator, photo };
}

function comment(client, photoId, text = 'Гарний кадр') {
  return client.post(`/api/photos/${photoId}/comments`).send({ text });
}

describe('POST /api/photos/:id/comments', () => {
  it('користувач коментує чужу світлину', async () => {
    const { stranger, photo } = await setup();
    const res = await comment(stranger.client, photo.id, '  Гарний кадр  ');

    expect(res.status).toBe(201);
    expect(res.body.comment).toMatchObject({
      id: 1,
      photoId: photo.id,
      text: 'Гарний кадр',
      author: { id: stranger.user.id, username: 'stranger', name: 'stranger', avatarUrl: null },
    });
    expect(res.body.comment.createdAt).toBe(res.body.comment.updatedAt);
    expect(res.body.comment.author.email).toBeUndefined();
  });

  it('без авторизації повертає 401', async () => {
    const { photo } = await setup();
    const res = await comment(agent(), photo.id);
    expect(res.status).toBe(401);
  });

  it('порожній або задовгий текст повертає 422', async () => {
    const { stranger, photo } = await setup();
    const empty = await comment(stranger.client, photo.id, '   ');
    const long = await comment(stranger.client, photo.id, 'a'.repeat(1001));

    expect(empty.status).toBe(422);
    expect(empty.body.error.fields.text).toBeDefined();
    expect(long.status).toBe(422);
  });

  it('до неіснуючої світлини повертає 404', async () => {
    const { stranger } = await setup();
    const res = await comment(stranger.client, 999);
    expect(res.status).toBe(404);
  });

  it('збільшує commentsCount світлини', async () => {
    const { stranger, owner, photo } = await setup();
    await comment(stranger.client, photo.id);
    await comment(owner.client, photo.id, 'Дякую');

    const res = await agent().get(`/api/photos/${photo.id}`);
    expect(res.body.photo.commentsCount).toBe(2);
  });
});

describe('GET /api/photos/:id/comments', () => {
  it('публічно повертає коментарі з пагінацією, нові першими', async () => {
    const { stranger, photo } = await setup();
    for (const text of ['перший', 'другий', 'третій']) {
      await comment(stranger.client, photo.id, text);
    }

    const res = await agent().get(`/api/photos/${photo.id}/comments?limit=2`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, limit: 2, pages: 2 });
    expect(res.body.items.map((item) => item.text)).toEqual(['третій', 'другий']);
  });

  it('повертає лише коментарі цієї світлини', async () => {
    const { stranger, owner, photo } = await setup();
    const other = (await upload(owner.client, 'Інша')).body.photo;
    await comment(stranger.client, photo.id, 'до першої');
    await comment(stranger.client, other.id, 'до другої');

    const res = await agent().get(`/api/photos/${other.id}/comments`);
    expect(res.body.items.map((item) => item.text)).toEqual(['до другої']);
  });

  it('для неіснуючої світлини повертає 404', async () => {
    const res = await agent().get('/api/photos/999/comments');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/comments/:id', () => {
  it('автор редагує свій коментар і оновлює updatedAt', async () => {
    const { stranger, photo } = await setup();
    const created = (await comment(stranger.client, photo.id)).body.comment;
    await new Promise((resolve) => setTimeout(resolve, 5));

    const res = await stranger.client.put(`/api/comments/${created.id}`).send({ text: 'Виправив' });

    expect(res.status).toBe(200);
    expect(res.body.comment.text).toBe('Виправив');
    expect(res.body.comment.createdAt).toBe(created.createdAt);
    expect(new Date(res.body.comment.updatedAt) > new Date(created.updatedAt)).toBe(true);
  });

  it('чужий коментар не може редагувати навіть ADMIN', async () => {
    const { stranger, admin, owner, photo } = await setup();
    const created = (await comment(stranger.client, photo.id)).body.comment;

    for (const client of [admin.client, owner.client]) {
      const res = await client.put(`/api/comments/${created.id}`).send({ text: 'Чуже' });
      expect(res.status).toBe(403);
    }
  });

  it('повертає 404 для неіснуючого і 422 для порожнього тексту', async () => {
    const { stranger, photo } = await setup();
    const created = (await comment(stranger.client, photo.id)).body.comment;

    const missing = await stranger.client.put('/api/comments/999').send({ text: 'x' });
    const empty = await stranger.client.put(`/api/comments/${created.id}`).send({ text: '' });

    expect(missing.status).toBe(404);
    expect(empty.status).toBe(422);
  });
});

describe('DELETE /api/comments/:id', () => {
  it('автор не може видалити свій коментар', async () => {
    const { stranger, photo } = await setup();
    const created = (await comment(stranger.client, photo.id)).body.comment;

    const res = await stranger.client.delete(`/api/comments/${created.id}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('MODERATOR і ADMIN видаляють коментарі', async () => {
    const { stranger, moderator, admin, photo } = await setup();
    const first = (await comment(stranger.client, photo.id)).body.comment;
    const second = (await comment(stranger.client, photo.id)).body.comment;

    expect((await moderator.client.delete(`/api/comments/${first.id}`)).status).toBe(204);
    expect((await admin.client.delete(`/api/comments/${second.id}`)).status).toBe(204);

    const list = await agent().get(`/api/photos/${photo.id}/comments`);
    expect(list.body.total).toBe(0);
  });

  it('повертає 404 для неіснуючого коментаря', async () => {
    const { moderator } = await setup();
    const res = await moderator.client.delete('/api/comments/999');
    expect(res.status).toBe(404);
  });

  it('коментарі видаляються разом зі світлиною', async () => {
    const { stranger, owner, photo } = await setup();
    await comment(stranger.client, photo.id);

    await owner.client.delete(`/api/photos/${photo.id}`);

    expect((await agent().get(`/api/photos/${photo.id}/comments`)).status).toBe(404);
  });
});
