jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const request = require('supertest');
const fakeDb = require('./helpers/fakeDb');
const { app } = require('./helpers/app');
const { PNG, team, upload } = require('./helpers/fixtures');
const { detectImageType } = require('../src/utils/imageType');

beforeEach(() => {
  fakeDb.reset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('завантаження файлу', () => {
  it('два файли в полі image дають 422', async () => {
    const { owner } = await team();
    const res = await owner.client
      .post('/api/photos')
      .field('description', 'Два файли')
      .attach('image', PNG, 'a.png')
      .attach('image', PNG, 'b.png');

    expect(res.status).toBe(422);
    expect(res.body.error.fields.image).toBe('Додайте один файл у поле image');
  });

  it('файл в іншому полі дає 422', async () => {
    const { owner } = await team();
    const res = await owner.client
      .post('/api/photos')
      .field('description', 'Не те поле')
      .attach('photo', PNG, 'a.png');

    expect(res.status).toBe(422);
    expect(res.body.error.fields.image).toBeDefined();
  });

  it('multipart без boundary дає 400', async () => {
    const { owner } = await team();
    const res = await owner.client
      .post('/api/photos')
      .set('Content-Type', 'multipart/form-data')
      .send('x');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('обірваний multipart дає 400, а не 500', async () => {
    const { owner } = await team();
    const res = await owner.client
      .post('/api/photos')
      .set('Content-Type', 'multipart/form-data; boundary=xyz')
      .send('--xyz\r\nContent-Disposition: form-data; name="description"\r\n\r\nбез кінця');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it.each([
    ['JPEG', [0xff, 0xd8, 0xff]],
    ['GIF', [...Buffer.from('GIF89a')]],
    ['WEBP', [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]],
  ])('приймає %s', async (_type, head) => {
    const { owner } = await team();
    const file = Buffer.concat([Buffer.from(head), Buffer.alloc(32)]);
    const res = await upload(owner.client, 'Формат', file, 'photo.bin');

    expect(res.status).toBe(201);
  });
});

describe('detectImageType', () => {
  it('розпізнає формати за сигнатурою', () => {
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(9)]))).toBe(
      'image/jpeg',
    );
  });

  it('короткий буфер, не буфер і RIFF без WEBP дають null', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    expect(detectImageType('GIF89a-string-not-buffer')).toBeNull();
    expect(
      detectImageType(Buffer.concat([Buffer.from('RIFF0000WAVE'), Buffer.alloc(4)])),
    ).toBeNull();
  });
});

describe('обробник помилок', () => {
  it('JSON більше 1 МБ дає 413', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a'.repeat(1024 * 1024 + 1) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('битий JSON дає 400', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('неочікувана помилка дає 500 INTERNAL_ERROR', async () => {
    const { owner } = await team();
    jest.spyOn(fakeDb.photo, 'findMany').mockRejectedValue(new Error('db down'));
    const res = await owner.client.get('/api/photos');

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'db down' });
  });
});
