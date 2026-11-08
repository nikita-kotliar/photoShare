const { z } = require('zod');
const { paginationSchema } = require('./common');

const date = z.iso.date({ error: 'Дата має бути у форматі YYYY-MM-DD' });

const usersQuerySchema = paginationSchema
  .extend({
    q: z
      .string()
      .trim()
      .max(100, { error: 'Запит не може бути довшим за 100 символів' })
      .optional(),
    role: z
      .enum(['USER', 'MODERATOR', 'ADMIN'], { error: 'Роль може бути USER, MODERATOR або ADMIN' })
      .optional(),
    registeredFrom: date.optional(),
    registeredTo: date.optional(),
  })
  .refine(
    ({ registeredFrom, registeredTo }) =>
      !registeredFrom || !registeredTo || registeredFrom <= registeredTo,
    { path: ['registeredTo'], error: 'Кінцева дата не може бути раніше за початкову' },
  );

const statusSchema = z.object({
  isActive: z.boolean({ error: 'Вкажіть true або false' }),
});

module.exports = { usersQuerySchema, statusSchema };
