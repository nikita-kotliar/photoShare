# Технічний стек

ТЗ не задає технології, тому вибір команди і обґрунтування нижче.

| Шар | Вибір | Чому | Альтернатива |
|---|---|---|---|
| Мова | JavaScript (Node.js 22) | одна мова на frontend і backend, найкраще що всі знають | TypeScript |
| Backend | Express 5 | простий фреймворк для API: легко додавати middleware, ролей користувача та все інше; в асинхронному більш простіше не отримати помилку, без лишніх обгорток | NestJS |
| БД | PostgreSQL | реляційні зв'язки вивчали його | MySQL, MongoDB |
| ORM | Prisma | міграції, типобезпечні запити, зручно для  БД-задач | Sequelize |
| Автентифікація | JWT в httpOnly cookie, bcryptjs | вимога ТЗ | - |
| Валідація | zod | те що всі знають | Joi |
| Файли | Cloudinary + multer | вимога ТЗ, файли не зберігаємо на сервері | S3 + sharp |
| QR | пакет qrcode | PNG data URL, зберігається в БД | - |
| Документація API | Swagger UI на `/api/docs` | вимога ТЗ | Redoc |
| Тести | Jest + Supertest | одною командою `npm test` багато можна покрити | Vitest |
| Frontend | Vite + vanilla JS, HTML/CSS | те що всі знають: JS, HTML/CSS; власний роутер і store | React |
| Контейнери | Docker Compose (db, backend, frontend з nginx) | один запуск локально і на сервері | - |
| CI | GitHub Actions | lint, тести і збірка на кожен PR | - |
| Деплой | власний хост і домен, HTTPS | публічний URL і завжди працює| Github Pages |

Шрифт: Poppins (латиниця). Poppins не містить кирилиці, тому для українського тексту стек шрифтів автоматично переходить на Montserrat
