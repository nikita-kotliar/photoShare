const { z } = require('zod');

const commentSchema = z.object({
  text: z
    .string({ error: 'Напишіть коментар' })
    .trim()
    .min(1, { error: 'Коментар не може бути порожнім' })
    .max(1000, { error: 'Коментар не може бути довшим за 1000 символів' }),
});

module.exports = { commentSchema };
