const { z } = require('zod');

const description = z
  .string({ error: 'Додайте опис світлини' })
  .trim()
  .min(1, { error: 'Додайте опис світлини' })
  .max(1000, { error: 'Опис не може бути довшим за 1000 символів' });

const transformationsSchema = z.strictObject(
  {
    effect: z
      .enum(['grayscale', 'sepia', 'blur'], { error: 'Ефект може бути grayscale, sepia або blur' })
      .optional(),
    angle: z
      .number({ error: 'Кут повороту має бути числом' })
      .int({ error: 'Кут повороту має бути цілим числом' })
      .min(0, { error: 'Кут повороту має бути від 0 до 359' })
      .max(359, { error: 'Кут повороту має бути від 0 до 359' })
      .optional(),
    crop: z.literal('square', { error: 'Обрізка може бути лише square' }).optional(),
  },
  { error: 'Некоректний набір трансформацій' },
);

const jsonField = (schema) =>
  z.preprocess((value) => {
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, schema);

const createPhotoSchema = z.object({
  description,
  transformations: jsonField(transformationsSchema.optional()),
});

const updatePhotoSchema = z.object({ description });

const idOrSlugParamsSchema = z.object({
  idOrSlug: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/, { error: 'Некоректне посилання на світлину' })
    .refine((value) => !/^\d+$/.test(value) || Number(value) <= 2147483647, {
      error: 'Некоректне посилання на світлину',
    }),
});

module.exports = {
  transformationsSchema,
  createPhotoSchema,
  updatePhotoSchema,
  idOrSlugParamsSchema,
};
