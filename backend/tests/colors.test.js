jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const { cloud } = require('cloudinary');
const fakeDb = require('./helpers/fakeDb');
const { agent } = require('./helpers/app');
const { signedIn, upload } = require('./helpers/fixtures');
const { colorFamily, familiesOf, paletteFromCloudinary } = require('../src/utils/colors');

beforeEach(() => {
  fakeDb.reset();
});

describe('палітра світлини', () => {
  it('зберігає головні кольори від Cloudinary (від 3 %) і віддає їх з групами', async () => {
    const { client } = await signedIn('owner');
    const { photo } = (await upload(client)).body;

    expect(photo.colors).toEqual([
      { hex: '#2b59ba', family: 'blue' },
      { hex: '#f2f6ff', family: 'white' },
      { hex: '#2b59ba', family: 'blue' },
    ]);
    const saved = await fakeDb.photo.findUnique({ where: { id: photo.id } });
    expect(saved.colorFamilies).toEqual(['blue', 'white']);
    expect((await agent().get(`/api/photos/${photo.slug}`)).body.photo.colors).toHaveLength(3);
  });

  it('без кольорів від Cloudinary палітра порожня', async () => {
    const before = cloud.colors;
    cloud.colors = undefined;
    const { client } = await signedIn('owner');
    const { photo } = (await upload(client)).body;
    cloud.colors = before;

    expect(photo.colors).toEqual([]);
  });
});

describe('colorFamily', () => {
  it.each([
    ['#ffffff', 'white'],
    ['#0a0a0a', 'black'],
    ['#8a8a8a', 'gray'],
    ['#e53935', 'red'],
    ['#fb8c00', 'orange'],
    ['#fdd835', 'yellow'],
    ['#43a047', 'green'],
    ['#00acc1', 'teal'],
    ['#1e88e5', 'blue'],
    ['#8e24aa', 'purple'],
    ['#ec407a', 'pink'],
    ['#6d4c41', 'brown'],
  ])('%s - %s', (hex, family) => {
    expect(colorFamily(hex)).toBe(family);
  });

  it('некоректні відтінки і частки менше 3 % відкидаються, групи без повторів', () => {
    const palette = paletteFromCloudinary([
      ['#ABCDEF', 50],
      ['nothex', 20],
      ['#123456', 2.9],
      ['ffffff', 10],
    ]);
    expect(palette).toEqual(['#abcdef', '#ffffff']);
    expect(familiesOf(['#1e88e5', '#2b59ba', '#ffffff'])).toEqual(['blue', 'white']);
  });
});
