const { z } = require('zod');
const { paginationSchema } = require('./common');
const { MAX_TAG_LENGTH } = require('./tags');

const date = z.iso.date({ error: 'Дата має бути у форматі YYYY-MM-DD' });

// Порожній параметр (?q=) вважаємо невказаним, а не помилкою
function optional(schema) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

const searchQuerySchema = paginationSchema
  .extend({
    q: optional(
      z
        .string({ error: 'Запит має бути рядком' })
        .trim()
        .max(100, { error: 'Запит не може бути довшим за 100 символів' }),
    ),
    // Теги зберігаються в нижньому регістрі (validators/tags.js), тож і шукаємо так само
    tag: optional(
      z
        .string({ error: 'Тег має бути рядком' })
        .trim()
        .toLowerCase()
        .max(MAX_TAG_LENGTH, { error: `Тег не може бути довшим за ${MAX_TAG_LENGTH} символів` }),
    ),
    sort: optional(z.enum(['date', 'rating'], { error: 'Сортування: date або rating' })).default(
      'date',
    ),
    order: optional(z.enum(['asc', 'desc'], { error: 'Порядок: asc або desc' })).default('desc'),
    ratingMin: optional(
      z.coerce
        .number({ error: 'Рейтинг має бути числом від 1 до 5' })
        .min(1, { error: 'Рейтинг має бути від 1 до 5' })
        .max(5, { error: 'Рейтинг має бути від 1 до 5' }),
    ),
    dateFrom: optional(date),
    dateTo: optional(date),
    username: optional(
      z
        .string({ error: 'Юзернейм має бути рядком' })
        .trim()
        .max(30, { error: 'Юзернейм не може бути довшим за 30 символів' }),
    ),
  })
  .refine(({ dateFrom, dateTo }) => !dateFrom || !dateTo || dateFrom <= dateTo, {
    path: ['dateTo'],
    error: 'Кінцева дата не може бути раніше за початкову',
  });

module.exports = { searchQuerySchema };
