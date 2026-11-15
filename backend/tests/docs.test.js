jest.mock('../src/config/db', () => require('./helpers/fakeDb'));

const request = require('supertest');
const app = require('../src/app');

const routes = [
  ['post', '/users', 'public'],
  ['get', '/users/me', 'auth'],
  ['post', '/sessions', 'public'],
  ['delete', '/sessions', 'public'],
  ['get', '/health', 'public'],
  ['get', '/photos', 'auth'],
  ['post', '/photos', 'auth'],
  ['get', '/photos/{id}', 'public'],
  ['put', '/photos/{id}', 'auth'],
  ['delete', '/photos/{id}', 'auth'],
  ['get', '/photos/{id}/links', 'public'],
  ['post', '/photos/{id}/links', 'auth'],
  ['get', '/photos/{id}/comments', 'public'],
  ['post', '/photos/{id}/comments', 'auth'],
  ['put', '/comments/{id}', 'auth'],
  ['delete', '/comments/{id}', 'auth'],
  ['post', '/photos/{id}/ratings', 'auth'],
  ['get', '/photos/{id}/ratings', 'auth'],
  ['delete', '/ratings/{id}', 'auth'],
  ['get', '/admin/users', 'auth'],
  ['patch', '/admin/users/{id}/status', 'auth'],
];

async function getSpec() {
  const res = await request(app).get('/api/docs.json').expect(200);
  return res.body;
}

function operations(spec) {
  return Object.entries(spec.paths).flatMap(([path, ops]) =>
    Object.keys(ops).map((method) => `${method} ${path}`),
  );
}

describe('GET /api/docs', () => {
  test('віддає Swagger UI без входу', async () => {
    const res = await request(app).get('/api/docs/').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('swagger-ui');
  });

  test('без слеша в кінці теж відкривається', async () => {
    const res = await request(app).get('/api/docs');
    expect([200, 301, 302]).toContain(res.status);
  });

  test('віддає статику Swagger UI', async () => {
    const res = await request(app).get('/api/docs/swagger-ui-init.js').expect(200);
    expect(res.text).toContain('PhotoShare API');
  });
});

describe('GET /api/docs.json', () => {
  test('OpenAPI 3 з базовим шляхом /api', async () => {
    const spec = await getSpec();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toBe('PhotoShare API');
    expect(spec.servers).toEqual([{ url: '/api' }]);
  });

  test('описано всі ендпоінти і нічого зайвого', async () => {
    const spec = await getSpec();
    const expected = routes.map(([method, path]) => `${method} ${path}`);
    expect(operations(spec).sort()).toEqual(expected.sort());
  });

  test('cookie-автентифікація описана і стоїть на захищених ендпоінтах', async () => {
    const spec = await getSpec();
    expect(spec.components.securitySchemes.cookieAuth).toEqual(
      expect.objectContaining({ type: 'apiKey', in: 'cookie', name: 'token' }),
    );
    for (const [method, path, access] of routes) {
      const security = spec.paths[path][method].security;
      if (access === 'auth') expect(security).toEqual([{ cookieAuth: [] }]);
      else expect(security).toBeUndefined();
    }
  });

  test('кожен описаний ендпоінт існує в застосунку', async () => {
    for (const [method, path] of routes) {
      const res = await request(app)[method](`/api${path.replace('{id}', '1')}`);
      expect(res.body?.error?.message).not.toBe('Ресурс не знайдено');
    }
  });

  test('усі $ref ведуть на існуючі компоненти', async () => {
    const spec = await getSpec();
    const refs = JSON.stringify(spec).match(/"\$ref":"[^"]+"/g);
    for (const ref of refs) {
      const [, , group, name] = ref.slice(8, -1).split('/');
      expect(spec.components[group]).toHaveProperty(name);
    }
  });

  test('у кожного ендпоінта є опис і відповідь успіху', async () => {
    const spec = await getSpec();
    for (const [method, path] of routes) {
      const op = spec.paths[path][method];
      expect(op.summary).toBeTruthy();
      expect(op.tags).toHaveLength(1);
      expect(Object.keys(op.responses).some((code) => code.startsWith('2'))).toBe(true);
    }
  });
});
