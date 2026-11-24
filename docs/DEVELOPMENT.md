# Розробка

## Запуск локально

Потрібні Node.js 22+ і Docker. Спершу `cp .env.example .env` і заповнити значення (приклад нижче).

| Як | Команди | Адреса |
|---|---|---|
| Усе в Docker | `docker compose up --build` | http://localhost:8080 |
| База в Docker, код локально | `docker compose up -d db`<br>`cd backend && npm ci && npm run db:deploy && npm run db:seed && npm run dev`<br>`cd frontend && npm ci && npm run dev` | http://localhost:5173, API http://localhost:3000/api |
| Лише фронтенд з мок-API | `cd frontend && npm ci && npm run dev:mock` | http://localhost:5173 |

Міграції застосовуються при старті контейнера бекенду. `db:seed` додає тестових користувачів з паролем `password123`; ті самі акаунти є в мок-API ([frontend/README.md](../frontend/README.md)).

## Змінні середовища

Повний список - [.env.example](../.env.example). Мінімум для розробки:

```env
NODE_ENV=development
POSTGRES_USER=photoshare
POSTGRES_PASSWORD=photoshare
POSTGRES_DB=photoshare
DATABASE_URL=postgresql://photoshare:photoshare@localhost:5432/photoshare
JWT_SECRET=dev-secret-change-me-please
COOKIE_SECURE=false
```

| Змінна | Для чого | Без неї |
|---|---|---|
| `DATABASE_URL`, `POSTGRES_*` | база даних | бекенд не стартує |
| `JWT_SECRET`, `JWT_EXPIRES_IN_HOURS` | підпис токена (від 16 символів), час життя сесії | бекенд не стартує |
| `CORS_ORIGIN`, `APP_URL` | адреса фронтенду для cookie і повернення після Google | `http://localhost:5173` |
| `COOKIE_SECURE`, `COOKIE_NAME`, `COOKIE_PATH`, `PUBLIC_API_PATH` | cookie сесії і шлях API | значення для локальної роботи |
| `CLOUDINARY_*` | сховище світлин | не можна публікувати світлини; у production бекенд не стартує |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | вхід через Google | кнопка Google повертає «недоступно» |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | листи відновлення пароля | локально посилання пишеться в консоль бекенду; на проді відновлення недоступне |
| `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_DAILY_LIMIT` | AI-підказки і AI-модерація | AI вимкнено, решта працює |
| `DB_PASSWORD`, `API_PORT`, `PUBLIC_ORIGIN` | лише `docker-compose.prod.yml` | - |

## Тести і перевірки

```bash
cd backend && npm run lint && npm test          # Jest + Supertest, база - мок у пам'яті
cd backend && npm run test:coverage             # поріг покриття 70 %
cd frontend && npm run lint && npm test && npm run build
```

Тести на справжньому PostgreSQL (`*.db.test.js`) вмикає `TEST_DATABASE_URL` - окрема тестова база, бо тести її очищають. CI на кожен PR запускає все разом з ними.

## Процес роботи

- Задачі - GitHub Issues `[TASK-NNN]` з мітками і milestone `Sprint-N`.
- Гілка `task/TASK-NNN-назва`, один issue - один PR, коміт `done TASK-NNN`.
- Merge після Approve і зеленого CI.
- Рішення, яких немає в ТЗ, і відхилення від макета - у [DECISIONS.md](DECISIONS.md).
