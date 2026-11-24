# Технології

ТЗ не задає стек, тож ми обрали те, що закриває вимоги і що команда знає.

| Шар | Вибір | Чому | Розглядали |
|---|---|---|---|
| Мова | JavaScript, Node.js 22 | одна мова на бекенді й фронтенді | TypeScript |
| Backend | Express 5 | мінімальний, асинхронні помилки обробляє сам, проста модель middleware для ролей | NestJS |
| База | PostgreSQL 17 | реляційні зв'язки, trigram-індекси для пошуку | MySQL, MongoDB |
| ORM | Prisma | схема як код, міграції, безпечні параметризовані запити | Sequelize |
| Валідація | zod | одна схема і для перевірки, і для повідомлень про помилки | Joi |
| Автентифікація | JWT в httpOnly cookie, bcrypt, Google OAuth 2.0 з PKCE | вимога ТЗ; cookie недоступна JavaScript | сесії в Redis |
| Файли | Cloudinary + multer | вимога ТЗ; трансформації і CDN без власного сервера файлів | S3 + sharp |
| Пошта | Nodemailer (SMTP) | листи відновлення пароля через будь-яку поштову скриньку | сторонні API розсилок |
| QR | qrcode | PNG одразу як data URL | - |
| Документація API | Swagger UI, OpenAPI 3 у YAML | вимога ТЗ; тест звіряє опис з маршрутами | Redoc |
| Тести | Jest + Supertest, Vitest | API тестується повністю через HTTP, частина - на справжньому PostgreSQL | Mocha |
| Frontend | Vite, vanilla JS, HTML/CSS | без фреймворку: власні роутер, стан і компоненти, мала збірка | React |
| Інфраструктура | Docker Compose, nginx, GitHub Actions | однаковий запуск локально і на сервері; lint, тести і збірка на кожен PR | - |
