const { z } = require('zod');

const id = z.coerce
  .number({ error: 'Некоректний ідентифікатор' })
  .int({ error: 'Некоректний ідентифікатор' })
  .positive({ error: 'Некоректний ідентифікатор' })
  .max(2147483647, { error: 'Некоректний ідентифікатор' });

const idParamsSchema = z.object({ id });

const paginationSchema = z.object({
  page: z.coerce
    .number({ error: 'Сторінка має бути числом' })
    .int({ error: 'Сторінка має бути цілим числом' })
    .min(1, { error: 'Сторінка починається з 1' })
    .default(1),
  limit: z.coerce
    .number({ error: 'Ліміт має бути числом' })
    .int({ error: 'Ліміт має бути цілим числом' })
    .min(1, { error: 'Ліміт має бути від 1 до 50' })
    .max(50, { error: 'Ліміт має бути від 1 до 50' })
    .default(12),
});

module.exports = { idParamsSchema, paginationSchema };
