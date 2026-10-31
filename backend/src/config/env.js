const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const raw = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));

if (raw.NODE_ENV === 'test') {
  raw.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  raw.JWT_SECRET ??= 'test-secret-test-secret-test-secret';
}

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16),
    JWT_EXPIRES_IN_HOURS: z.coerce.number().positive().default(24),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return;
    for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      if (!data[key])
        ctx.addIssue({ code: 'custom', path: [key], message: 'обов’язкова в production' });
    }
  });

const parsed = schema.safeParse(raw);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Некоректні змінні середовища:\n${problems}`);
}

const env = parsed.data;

module.exports = {
  ...env,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  corsOrigins: env.CORS_ORIGIN.split(',').map((item) => item.trim()),
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
};
