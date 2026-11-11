const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://x:x@localhost:5432/x',
  JWT_SECRET: 'env-test-secret-env-test-secret',
};

const saved = process.env;

function loadEnv(vars) {
  process.env = { ...vars };
  let env;
  jest.isolateModules(() => {
    jest.doMock('dotenv', () => ({ config: () => {} }));
    env = require('../src/config/env');
  });
  return env;
}

afterEach(() => {
  process.env = saved;
});

describe('config/env', () => {
  it('підставляє значення за замовчуванням', () => {
    const env = loadEnv(base);

    expect(env.PORT).toBe(3000);
    expect(env.JWT_EXPIRES_IN_HOURS).toBe(24);
    expect(env.corsOrigins).toEqual(['http://localhost:5173']);
    expect(env.cookieSecure).toBe(false);
    expect(env.isProduction).toBe(false);
  });

  it('CORS_ORIGIN через кому дає список, COOKIE_SECURE перекриває типове значення', () => {
    const env = loadEnv({
      ...base,
      CORS_ORIGIN: 'https://a.com, https://b.com',
      COOKIE_SECURE: 'true',
    });

    expect(env.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(env.cookieSecure).toBe(true);
  });

  it('без DATABASE_URL і з коротким JWT_SECRET не запускається', () => {
    expect(() => loadEnv({ NODE_ENV: 'development', JWT_SECRET: 'short' })).toThrow(
      /DATABASE_URL[\s\S]*JWT_SECRET/,
    );
  });

  it('порожній рядок вважається відсутньою змінною', () => {
    expect(() => loadEnv({ ...base, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('у production вимагає ключі Cloudinary і вмикає secure cookie', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /CLOUDINARY_CLOUD_NAME: обов’язкова в production/,
    );

    const env = loadEnv({
      ...base,
      NODE_ENV: 'production',
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    });
    expect(env.isProduction).toBe(true);
    expect(env.cookieSecure).toBe(true);
  });

  it('у test підставляє тестові DATABASE_URL і JWT_SECRET', () => {
    const env = loadEnv({ NODE_ENV: 'test' });

    expect(env.isTest).toBe(true);
    expect(env.DATABASE_URL).toMatch(/^postgresql:/);
  });
});
