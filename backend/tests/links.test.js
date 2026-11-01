jest.mock('../src/config/db', () => require('./helpers/fakeDb'));
jest.mock('../src/services/cloudinaryService', () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
  transformedUrl: jest.fn(
    (publicId, { effect = 'none' }) =>
      `https://res.cloudinary.com/demo/image/upload/e_${effect}/v1/${publicId}`,
  ),
}));

const fakeDb = require('./helpers/fakeDb');
const cloudinaryService = require('../src/services/cloudinaryService');
const { agent } = require('./helpers/app');
const { mockCloudinary, team, upload } = require('./helpers/fixtures');

beforeEach(() => {
  fakeDb.reset();
  jest.clearAllMocks();
  mockCloudinary(cloudinaryService);
});

async function ownerPhoto() {
  const members = await team();
  const { photo } = (await upload(members.owner.client)).body;
  return { ...members, photo };
}

function createLink(client, photoId, transformations = { effect: 'sepia' }) {
  return client.post(`/api/photos/${photoId}/links`).send({ transformations });
}

describe('POST /api/photos/:id/links', () => {
  it('власник створює посилання з QR-кодом', async () => {
    const { owner, photo } = await ownerPhoto();
    const transformations = { effect: 'sepia', angle: 90, crop: 'square' };
    const res = await createLink(owner.client, photo.id, transformations);

    expect(res.status).toBe(201);
    expect(cloudinaryService.transformedUrl).toHaveBeenCalledWith('photoshare/p1', transformations);
    expect(res.body.link).toMatchObject({
      id: 1,
      photoId: photo.id,
      url: 'https://res.cloudinary.com/demo/image/upload/e_sepia/v1/photoshare/p1',
      transformations,
    });
    expect(res.body.link.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(res.body.link.createdAt).toBeDefined();
  });

  it('кожен POST створює новий запис, навіть з тим самим набором', async () => {
    const { owner, photo } = await ownerPhoto();
    const first = await createLink(owner.client, photo.id);
    const second = await createLink(owner.client, photo.id);

    expect(first.body.link.id).toBe(1);
    expect(second.body.link.id).toBe(2);
    expect(second.body.link.url).toBe(first.body.link.url);
  });

  it('ADMIN створює посилання для чужої світлини', async () => {
    const { admin, photo } = await ownerPhoto();
    const res = await createLink(admin.client, photo.id);

    expect(res.status).toBe(201);
  });

  it('без авторизації 401, чужий користувач і модератор 403', async () => {
    const { stranger, photo } = await ownerPhoto();
    const guest = await createLink(agent(), photo.id);
    const foreign = await createLink(stranger.client, photo.id);
    await fakeDb.user.update({ where: { id: stranger.user.id }, data: { role: 'MODERATOR' } });
    const moderator = await createLink(stranger.client, photo.id);

    expect(guest.status).toBe(401);
    expect(foreign.status).toBe(403);
    expect(moderator.status).toBe(403);
    expect(cloudinaryService.transformedUrl).not.toHaveBeenCalled();
  });

  it('неіснуюча світлина 404, некоректний id 422', async () => {
    const { owner } = await ownerPhoto();
    const missing = await createLink(owner.client, 999);
    const invalid = await createLink(owner.client, 'abc');

    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(422);
  });

  it('порожній або некоректний набір трансформацій повертає 422', async () => {
    const { owner, photo } = await ownerPhoto();
    const cases = [
      [{}, 'transformations'],
      [null, 'transformations'],
      [{ effect: 'vintage' }, 'transformations.effect'],
      [{ angle: -1 }, 'transformations.angle'],
      [{ crop: 'circle' }, 'transformations.crop'],
      [{ width: 100 }, 'transformations'],
    ];

    for (const [transformations, field] of cases) {
      const res = await createLink(owner.client, photo.id, transformations);
      expect(res.status).toBe(422);
      expect(res.body.error.fields[field]).toBeDefined();
    }
    const noBody = await owner.client.post(`/api/photos/${photo.id}/links`).send({});
    expect(noBody.status).toBe(422);
    expect(noBody.body.error.fields.transformations).toBeDefined();
    expect(cloudinaryService.transformedUrl).not.toHaveBeenCalled();
  });
});

describe('GET /api/photos/:id/links', () => {
  it('публічно віддає посилання світлини, нові першими', async () => {
    const { owner, photo } = await ownerPhoto();
    await createLink(owner.client, photo.id, { effect: 'sepia' });
    await createLink(owner.client, photo.id, { effect: 'blur' });

    const res = await agent().get(`/api/photos/${photo.id}/links`);

    expect(res.status).toBe(200);
    expect(res.body.items.map((link) => link.id)).toEqual([2, 1]);
    expect(res.body.items[0].transformations).toEqual({ effect: 'blur' });
    expect(res.body.items[0].qrCode).toMatch(/^data:image\/png;base64,/);
  });

  it('повертає лише посилання цієї світлини', async () => {
    const { owner, photo } = await ownerPhoto();
    const { photo: other } = (await upload(owner.client)).body;
    await createLink(owner.client, other.id);

    const res = await agent().get(`/api/photos/${photo.id}/links`);

    expect(res.body.items).toEqual([]);
  });

  it('неіснуюча світлина повертає 404', async () => {
    const res = await agent().get('/api/photos/999/links');
    expect(res.status).toBe(404);
  });

  it('посилання видаляються разом зі світлиною', async () => {
    const { owner, photo } = await ownerPhoto();
    await createLink(owner.client, photo.id);
    await owner.client.delete(`/api/photos/${photo.id}`);

    const res = await agent().get(`/api/photos/${photo.id}/links`);

    expect(res.status).toBe(404);
  });
});
