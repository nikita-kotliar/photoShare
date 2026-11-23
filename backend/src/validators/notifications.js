const { z } = require('zod');

const id = z
  .number({ error: 'Ідентифікатор має бути числом' })
  .int({ error: 'Некоректний ідентифікатор' })
  .positive({ error: 'Некоректний ідентифікатор' })
  .max(2147483647, { error: 'Некоректний ідентифікатор' });

// Без ids позначаються прочитаними всі сповіщення користувача
const markReadSchema = z.object({
  ids: z
    .array(id, { error: 'ids має бути масивом' })
    .min(1, { error: 'Вкажіть хоча б одне сповіщення' })
    .max(100, { error: 'Не більше 100 сповіщень за раз' })
    .optional(),
});

module.exports = { markReadSchema };
