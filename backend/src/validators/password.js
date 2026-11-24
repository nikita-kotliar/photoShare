const { z } = require('zod');
const { email, password } = require('./auth');

const forgotSchema = z.object({ email });

const resetSchema = z.object({
  token: z.string({ error: 'Посилання недійсне' }).regex(/^[0-9a-f]{64}$/, {
    error: 'Посилання недійсне або застаріло. Попросіть новий лист',
  }),
  password,
});

module.exports = { forgotSchema, resetSchema };
