// Пошук за кольором на справжньому PostgreSQL (TEST_DATABASE_URL, як у search.db.test.js)
const db = require('../src/config/db');
const { agent, register } = require('./helpers/app');

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb('пошук за кольором на PostgreSQL', () => {
  let client;

  beforeAll(async () => {
    await db.$executeRawUnsafe('TRUNCATE users, photos RESTART IDENTITY CASCADE');
    client = agent();
    const { body } = await register(client, { username: 'viewer', email: 'viewer@example.com' });
    const palettes = [['#1e88e5', '#ffffff'], ['#43a047'], []];
    for (const [i, colors] of palettes.entries()) {
      await db.photo.create({
        data: {
          slug: `color${i}`,
          url: `https://example.com/${i}.png`,
          publicId: `photoshare/color${i}`,
          description: `Світлина ${i}`,
          authorId: body.user.id,
          colors,
          colorFamilies: [
            ...new Set(
              colors.map((c) => (c === '#ffffff' ? 'white' : c === '#43a047' ? 'green' : 'blue')),
            ),
          ],
        },
      });
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it.each([
    ['blue', ['Світлина 0']],
    ['white', ['Світлина 0']],
    ['green', ['Світлина 1']],
    ['red', []],
  ])('color=%s', async (color, expected) => {
    const res = await client.get(`/api/search/photos?color=${color}`);
    expect(res.status).toBe(200);
    expect(res.body.items.map((p) => p.description)).toEqual(expected);
  });

  it('у відповіді палітра з групами', async () => {
    const res = await client.get('/api/search/photos?color=blue');
    expect(res.body.items[0].colors).toEqual([
      { hex: '#1e88e5', family: 'blue' },
      { hex: '#ffffff', family: 'white' },
    ]);
  });
});
