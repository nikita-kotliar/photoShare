const { z } = require('zod');
const { username, email, name } = require('./auth');

const usernameParamsSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_.-]{1,30}$/, { error: 'Некоректний юзернейм' }),
});

// «Про себе»: необов'язкове, до 300 символів. Порожній рядок очищає поле (зберігаємо null)
const bio = z
  .string({ error: 'Поле «Про себе» має бути рядком' })
  .trim()
  .max(300, { error: 'Поле «Про себе» не може бути довшим за 300 символів' })
  .transform((value) => value || null);

// Змінювати можна лише ці поля: role, isActive, passwordHash та інше zod відкидає
const updateMeSchema = z
  .object({
    name: name.optional(),
    username: username.optional(),
    email: email.optional(),
    bio: bio.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    error: 'Вкажіть хоча б одне поле: name, username, email або bio',
  });

module.exports = { usernameParamsSchema, updateMeSchema };
