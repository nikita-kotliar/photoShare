
const { z } = require('zod');
const { tagsSchema } = require('./tags');

const description = z
  .string({ error: 'Додайте опис світлини' })
  .trim()
  .min(1, { error: 'Додайте опис світлини' })
  .max(1000, { error: 'Опис не може бути довшим за 1000 символів' });

const createPhotoSchema = z.object({
  description,
  tags: tagsSchema,
});

const updatePhotoSchema = z.object({
  description: description.optional(),
  tags: tagsSchema,
});

const idOrSlugParamsSchema = z.object({
  idOrSlug: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/, {
      error: 'Некоректне посилання на світлину',
    })
    .refine((value) => !/^\d+$/.test(value) || Number(value) <= 2147483647, {
      error: 'Некоректне посилання на світлину',
    }),
});

module.exports = { createPhotoSchema, updatePhotoSchema, idOrSlugParamsSchema };
