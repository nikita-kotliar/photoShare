# PhotoShare

Соціальна платформа для обміну світлинами: реєстрація, завантаження світлин з описом і тегами, трансформації через Cloudinary, QR-код посилання, коментарі, рейтинг, пошук. Три ролі: користувач, модератор, адміністратор.

Навчальний командний проєкт. Дизайн: Figma PhotoShare. ТЗ: PhotoShare - Технічне завдання.

## Посилання

- Сайт: https://kotdenik.cx.ua/photoshare/
- Документація API (Swagger): https://kotdenik.cx.ua/photoshare-api/docs/ (локально http://localhost:3000/api/docs)
- Контракт API: [docs/API.md](docs/API.md), модель даних: [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- Деплой: [docs/DEPLOY.md](docs/DEPLOY.md)

## Команда

| Учасник | Роль |
|---|---|
| Котляр Нікіта | Backend, Docker, Team Lead |
| Сметанко Вероніка | Frontend |
| Говорун Ксенія | БД, Frontend |

## Можливості

| Роль | Що може |
|---|---|
| Гість | реєстрація і вхід, сторінка світлини за посиланням, профілі користувачів |
| Користувач | стрічка, завантаження світлини (до 5 тегів), редагування і видалення своїх світлин, трансформації і QR-коди, коментарі, одна оцінка 1-5 на чужу світлину, редагування профілю |
| Модератор | те саме, плюс видалення будь-яких коментарів і оцінок, перегляд списку користувачів |
| Адміністратор | те саме, плюс редагування і видалення будь-яких світлин, блокування користувачів, призначення модераторів |

Перший зареєстрований користувач отримує роль адміністратора.

## Стек

- Backend: Node.js 22, Express 5, PostgreSQL 17, Prisma, JWT в httpOnly cookie, zod, Cloudinary, Swagger, Jest + Supertest
- Frontend: Vite, vanilla JS, HTML/CSS, Vitest
- Інфраструктура: Docker Compose, nginx, GitHub Actions
- Обґрунтування вибору: [docs/TECH.md](docs/TECH.md)

## Запуск локально

Потрібні Node.js 22+ і Docker. Усі команди з кореня репозиторію.

**1. Змінні середовища.** Скопіювати шаблон і заповнити:

```bash
cp .env.example .env
```

Значення для розробки (рядки, яких тут немає, можна лишити порожніми):

```env
NODE_ENV=development
PORT=3000
POSTGRES_USER=photoshare
POSTGRES_PASSWORD=photoshare
POSTGRES_DB=photoshare
DATABASE_URL=postgresql://photoshare:photoshare@localhost:5432/photoshare
JWT_SECRET=dev-secret-change-me-please
JWT_EXPIRES_IN_HOURS=24
CORS_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Ключі Cloudinary потрібні, щоб завантажувати світлини. Без них решта застосунку працює.

**2а. Усе в Docker.** Сайт на http://localhost:8080, міграції застосовуються при старті:

```bash
docker compose up --build
```

**2б. Для розробки: база в Docker, backend і frontend локально.**

```bash
docker compose up -d db
cd backend && npm ci && npm run db:deploy && npm run db:seed && npm run dev
cd frontend && npm ci && npm run dev
```

Frontend: http://localhost:5173, API: http://localhost:3000/api. `db:seed` додає тестових користувачів з паролем `password123` (список у [frontend/README.md](frontend/README.md)).

**2в. Frontend без backend** (мок-API з тестовими даними):

```bash
cd frontend && npm ci && npm run dev:mock
```

## Змінні середовища

Повний список у [.env.example](.env.example).

| Змінна | Для чого |
|---|---|
| `NODE_ENV`, `PORT` | режим і порт backend |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | база в `docker-compose.yml` |
| `DATABASE_URL` | підключення Prisma до бази |
| `JWT_SECRET`, `JWT_EXPIRES_IN_HOURS` | підпис токена (від 16 символів) і час життя сесії |
| `CORS_ORIGIN` | адреса frontend, з якої дозволені запити з cookie |
| `COOKIE_SECURE`, `COOKIE_NAME`, `COOKIE_PATH` | параметри cookie сесії (`false` для http локально) |
| `PUBLIC_API_PATH` | шлях API у Swagger, за замовчуванням `/api` |
| `CLOUDINARY_*` | сховище світлин, обов'язкові в production |
| `DB_PASSWORD`, `API_PORT`, `PUBLIC_ORIGIN` | лише для `docker-compose.prod.yml` на сервері |

Frontend: `VITE_API_URL` і `VITE_PROXY_TARGET` у [frontend/.env.example](frontend/.env.example), за замовчуванням не потрібні.

## Тести і перевірки

```bash
cd backend && npm test             # Jest + Supertest, база замінена моком у пам'яті
cd backend && npm run test:coverage # з порогом покриття 70%
cd backend && npm run lint
cd frontend && npm test && npm run lint && npm run build
```

Те саме запускає CI на кожен PR.

## Рішення по неоднозначностях ТЗ

Головне, решта з поясненнями в [docs/DECISIONS.md](docs/DECISIONS.md):

- Після реєстрації користувач одразу в акаунті, вхід за email і паролем (D-02, D-33).
- Без входу відкриті стартова сторінка, вхід, профілі і сторінка світлини за посиланням. Посилання на світлину - випадковий `slug`, а не `id` (D-07, D-14).
- Вихід блокує токен лише поточної сесії, бан і нова роль діють одразу на всі сесії (D-03, D-36). Модератора призначає адміністратор в адмінці (D-51).
- Чужий коментар не редагує ніхто, навіть адміністратор, модератор і адмін можуть лише видаляти (D-16).
- Оцінку не можна змінити, лише модератор чи адмін її видаляє. Свою світлину оцінити не можна (D-44).
- Трансформації не змінюють оригінал: кожне посилання з QR - це URL Cloudinary з параметрами (D-08, D-22).
- Сайт і API на одному домені, на сервері з підшляхів `/photoshare/` і `/photoshare-api/` (D-01, D-43).
- Відхилення від макета (поля, кольори, тексти) теж записані в журналі рішень, з причиною для кожного.

## Процес роботи

- Задачі: GitHub Issues `[TASK-NNN]`, мітки `area:*`, `priority:*`, `size:*`, milestones `Sprint-N`, дошка GitHub Projects
- Гілки: `task/TASK-NNN-коротка-назва`, один issue - один PR, у PR `Closes #N`
- Merge тільки після Approve і зеленого CI
- Рішення, яких немає в ТЗ, записуємо в [docs/DECISIONS.md](docs/DECISIONS.md)
- Змінні середовища тільки в `.env` (не в git), усі ключі в `.env.example`

## Структура

```
backend/    REST API (Express, Prisma), Swagger у src/docs, тести в tests/
frontend/   SPA (Vite), мок-API в mock/
deploy/     nginx-сніпет і скрипт оновлення сервера
docs/       API, модель даних, рішення, стек, деплой
.github/    CI і шаблон PR
```
