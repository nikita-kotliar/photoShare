const { z } = require('zod');

const ratingSchema = z.object({
  value: z
    .number({ error: 'Оцінка має бути числом від 1 до 5' })
    .int({ error: 'Оцінка має бути цілим числом від 1 до 5' })
    .min(1, { error: 'Оцінка має бути від 1 до 5' })
    .max(5, { error: 'Оцінка має бути від 1 до 5' }),
});

module.exports = { ratingSchema };
