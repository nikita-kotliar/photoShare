const path = require('node:path');
const { Router } = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { version } = require('../../package.json');

const description = [
  'REST API застосунку PhotoShare. Повний контракт і правила валідації: `docs/API.md`.',
  '',
  '**Автентифікація.** Сервер ставить JWT у httpOnly cookie `token` після `POST /users` або `POST /sessions`.',
  'JavaScript цю cookie не бачить, браузер сам надсилає її з кожним запитом на цей домен.',
  'Щоб спробувати захищені ендпоінти тут, виконайте `POST /sessions` через «Try it out»: cookie збережеться, і наступні запити підуть від імені цього користувача.',
  '`DELETE /sessions` завершує сесію.',
].join('\n');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'PhotoShare API', version, description },
    servers: [{ url: '/api' }],
    tags: [
      { name: 'Автентифікація' },
      { name: 'Світлини' },
      { name: 'Трансформації і QR' },
      { name: 'Коментарі' },
      { name: 'Адміністрування' },
      { name: 'Сервіс' },
    ],
  },
  apis: [path.join(__dirname, 'openapi', '*.yaml').replaceAll('\\', '/')],
  failOnErrors: true,
});

const router = Router();

router.get('/docs.json', (_req, res) => res.json(spec));
router.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(spec, {
    customSiteTitle: 'PhotoShare API',
    swaggerOptions: { withCredentials: true },
  }),
);

module.exports = { spec, router };
