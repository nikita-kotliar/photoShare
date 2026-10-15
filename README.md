# PhotoShare

Соціальна платформа для обміну світлинами: реєстрація, завантаження світлин з описом і тегами, трансформації через Cloudinary, QR-код посилання, коментарі, рейтинг, пошук. Три ролі: користувач, модератор, адміністратор.

Навчальний командний проєкт. Дизайн: Figma PhotoShare. ТЗ: PhotoShare - Технічне завдання.

## Команда

| Учасник | Роль |
|---|---|
| Котляр Нікіта | Backend, Docker, Team Lead |
| Сметанко Вероніка | Frontend |
| Говорун Ксенія | БД, Frontend |

## Стек

- Backend: Node.js 22, Express 5, PostgreSQL 17, Prisma, JWT в httpOnly cookie, zod, Jest + Supertest
- Frontend: Vite, vanilla JS, HTML/CSS
- Інфраструктура: Docker Compose, nginx, GitHub Actions
- Обґрунтування вибору: [docs/TECH.md](docs/TECH.md), рішення: [docs/DECISIONS.md](docs/DECISIONS.md)

## Посилання

- Деплой: _буде додано_
- Документація API: _буде додано (маршрут /api/docs)_. Контракт: [docs/API.md](docs/API.md)

## Запуск локально

Потрібні Node.js 22+, Docker.

1. Створити `.env` з шаблону і заповнити значення (приклад нижче)


2. Приклад значень для розробки
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
```

3. Повністю в Docker (сайт на http://localhost:8080)
```bash
docker compose up --build
```

4. Для розробки: БД в Docker, backend і frontend локально
```bash
docker compose up -d db
cd backend && npm install && npx prisma migrate deploy && npm run dev
cd frontend && npm install && npm run dev
```
Frontend: http://localhost:5173, API: http://localhost:3000/api

5. Frontend без backend (мок-API з тестовими даними)
```bash
cd frontend && npm install && npm run dev:mock
```
Тестові акаунти і дані: [frontend/README.md](frontend/README.md)


## Процес роботи

- Задачі: GitHub Issues `[TASK-NNN]`, мітки `area:*`, `priority:*`, `size:*`, milestones `Sprint-N`, дошка GitHub Projects
- Гілки: `task/TASK-NNN-коротка-назва`, один issue - один PR, у PR `Closes #N`
- Merge тільки після Approve
- Рішення, яких немає в ТЗ, записуємо в [docs/DECISIONS.md](docs/DECISIONS.md)
- Змінні середовища тільки в `.env` (не в git), усі ключі в `.env.example`

## Структура

```
backend/    окремий проєкт: REST API (Express, Prisma), свій package.json
frontend/   окремий проєкт: SPA (Vite), свій package.json
docs/       API.md, TECH.md, DECISIONS.md
.github/    CI і шаблон PR
```
