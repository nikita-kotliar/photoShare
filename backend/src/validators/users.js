const { z } = require('zod');
const { username, email, name } = require('./auth');

const usernameParamsSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_.-]{1,30}$/, { error: 'Некоректний юзернейм' }),
});

// Змінювати можна лише ці поля: role, isActive, passwordHash та інше zod відкидає
const updateMeSchema = z
  .object({ name: name.optional(), username: username.optional(), email: email.optional() })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    error: 'Вкажіть хоча б одне поле: name, username або email',
  });

module.exports = { usernameParamsSchema, updateMeSchema };
