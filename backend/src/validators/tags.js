const { z } = require('zod');

const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 30;

// Нижній регістр, trim, без порожніх і дублікатів. Порядок першої появи зберігаємо.
function normalizeTags(list) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const name = String(item).trim().toLowerCase();
    if (name === '' || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

// Приймає масив, JSON-масив у рядку ('["a","b"]'), рядок через кому ('a, b')
// або повторювані поля multipart (multer віддає їх масивом).
// undefined лишається undefined: у PUT це означає "теги не змінювати".
function parseTagsInput(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return [];

  let list = value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      list = Array.isArray(parsed) ? parsed : value.split(',');
    } catch {
      list = value.split(',');
    }
  }

  if (!Array.isArray(list)) return value; // zod відхилить: "Некоректні теги"
  const simple = list.every((item) => ['string', 'number', 'boolean'].includes(typeof item));
  return simple ? normalizeTags(list) : list;
}

const tagsSchema = z.preprocess(
  parseTagsInput,
  z
    .array(z.string({ error: 'Тег має бути текстом' }), { error: 'Некоректні теги' })
    .refine((list) => list.length <= MAX_TAGS, {
      error: `Можна додати не більше ${MAX_TAGS} тегів`,
    })
    .refine((list) => list.every((tag) => tag.length <= MAX_TAG_LENGTH), {
      error: `Тег не може бути довшим за ${MAX_TAG_LENGTH} символів`,
    })
    .optional(),
);

module.exports = { MAX_TAGS, MAX_TAG_LENGTH, normalizeTags, parseTagsInput, tagsSchema };
