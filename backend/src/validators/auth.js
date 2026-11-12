const { z } = require('zod');

const email = z
  .string({ error: 'Вкажіть email' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Некоректний email' }));

const password = z
  .string({ error: 'Вкажіть пароль' })
  .min(8, { error: 'Пароль має містити щонайменше 8 символів' })
  .max(72, { error: 'Пароль не може бути довшим за 72 символи' });

const username = z
  .string({ error: 'Вкажіть юзернейм' })
  .trim()
  .min(3, { error: 'Юзернейм має містити щонайменше 3 символи' })
  .max(30, { error: 'Юзернейм не може бути довшим за 30 символів' })
  .regex(/^[a-zA-Z0-9_.-]+$/, {
    error: 'Дозволені лише латинські літери, цифри та символи _ . -',
  })
  // /api/users/me - окремий маршрут, тому юзернейм "me" зайняв би чужий профіль
  .refine((value) => value.toLowerCase() !== 'me', { error: 'Цей юзернейм зарезервовано' });

const name = z
  .string({ error: 'Ім\u2019я має бути рядком' })
  .trim()
  .min(1, { error: 'Ім\u2019я не може бути порожнім' })
  .max(60, { error: 'Ім\u2019я не може бути довшим за 60 символів' });

const registerSchema = z.object({
  username,
  email,
  password,
  name: name.optional(),
});

const loginSchema = z.object({
  email,
  password: z.string({ error: 'Вкажіть пароль' }).min(1, { error: 'Вкажіть пароль' }),
});

module.exports = { registerSchema, loginSchema, username, email, name };
