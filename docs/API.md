# API

Базовий URL: `/api`. Формат: JSON (завантаження світлини: `multipart/form-data`). Автентифікація: JWT в httpOnly cookie `token`, яку ставить сервер при реєстрації і логіні. Клієнт надсилає запити з `credentials: include`.


**Помилки** (усі однакового формату):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Помилка валідації", "fields": { "email": "Некоректний email" } } }
```

| Код HTTP | code | Коли |
|---|---|---|
| 400 | BAD_REQUEST | некоректний JSON |
| 401 | UNAUTHORIZED, TOKEN_INVALID, INVALID_CREDENTIALS | немає сесії, токен недійсний, невірний логін/пароль |
| 403 | FORBIDDEN, USER_BANNED | немає прав, акаунт заблоковано |
| 404 | NOT_FOUND | ресурс не знайдено |
| 409 | CONFLICT | дублікат (email, username, оцінка) |
| 413 | PAYLOAD_TOO_LARGE | завеликий запит або файл |
| 422 | VALIDATION_ERROR | помилки валідації, `fields` по полях |
| 500 | INTERNAL_ERROR | внутрішня помилка |

**Пагінація:** `?page=1&limit=12` (limit до 50). Відповідь: `{ "items": [], "total": 0, "page": 1, "limit": 12, "pages": 0 }`.

**Ролі:** `USER`, `MODERATOR`, `ADMIN`. Перший зареєстрований користувач - `ADMIN`. Стовпець "Доступ": `public` без входу, `auth` будь-який користувач, `owner` власник ресурсу, `staff` MODERATOR і ADMIN.

**Користувач** (`user`): `{ id, username, name, email, role, isActive, avatarUrl, createdAt }`. `avatarUrl` - рядок або `null`. 

## Автентифікація

| Метод і шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|
| POST `/api/users` | public | `{ username, email, password, name? }` | 201 `{ user }`, ставить cookie |
| POST `/api/sessions` | public | `{ email, password }` | 200 `{ user }`, ставить cookie |
| DELETE `/api/sessions` | public | - | 204, очищає cookie; з Sprint-4 токен потрапляє в blacklist |
| GET `/api/users/me` | auth | - | 200 `{ user }` |
| GET `/api/health` | public | - | 200 `{ status, uptime }` |

Правила валідації: `username` 3-30 символів `[a-zA-Z0-9_.-]`, `email` валідний (зберігається в нижньому регістрі), `password` 8-72 символи, `name` 1-60 символів (за замовчуванням дорівнює `username`). Забанений користувач не може увійти (403 `USER_BANNED`).

## Користувачі і профіль

| Метод і шлях | Доступ | Тіло / query | Відповідь |
|---|---|---|---|
| PUT `/api/users/me` | auth | `{ name?, username?, email? }` | 200 `{ user }` |
| GET `/api/users/:username` | public | - | 200 `{ user: { username, name, avatarUrl, createdAt, photosCount } }` |
| GET `/api/users/:username/photos` | public | `page, limit` | 200 пагінований список світлин |

## Світлини

`photo`: `{ id, slug, url, description, tags: [string], author: { id, username, name, avatarUrl }, averageRating, ratingsCount, commentsCount, myRating, createdAt, updatedAt }`. `averageRating` - число з одним знаком або `null`, якщо оцінок немає. `myRating` - оцінка поточного користувача або `null`, лише для авторизованих запитів.

| Метод і шлях | Доступ | Тіло / query | Відповідь |
|---|---|---|---|
| GET `/api/photos` | auth | `page, limit` | 200 стрічка, нові першими |
| POST `/api/photos` | auth | form-data: `image` (файл), `description`, `tags` (до 5, необов'язково), `transformations` (JSON, необов'язково) | 201 `{ photo }` |
| GET `/api/photos/:idOrSlug` | public | - | 200 `{ photo }`, доступний за унікальним посиланням |
| PUT `/api/photos/:id` | owner, ADMIN | `{ description, tags? }` | 200 `{ photo }` |
| DELETE `/api/photos/:id` | owner, ADMIN | - | 204 |

Файл `image`: один, до 10 МБ (більше: 413), JPEG / PNG / WEBP / GIF. Тип перевіряється за вмістом файлу, а не за розширенням (інше: 422 з `fields.image`). `description`: 1-1000 символів. `slug`: випадковий рядок з 12 символів `[A-Za-z0-9_-]`, `:idOrSlug` приймає або числовий `id`, або `slug`.

Теги: до 5 на світлину, унікальні в усьому застосунку (існуючий береться, нового немає - створюється), нормалізуються до нижнього регістру. Довжина тега 1-30 символів (після обрізання пробілів і приведення до нижнього регістру). Шостий тег або тег неприпустимої довжини: 422.

## Трансформації і QR

| Метод і шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|
| POST `/api/photos/:id/links` | owner, ADMIN | `{ transformations: { effect?, angle?, crop? } }` | 201 `{ link: { id, url, qrCode, transformations, createdAt } }` |
| GET `/api/photos/:id/links` | public | - | 200 `{ items: [link] }` |

Набір трансформацій: `effect` = `grayscale` / `sepia` / `blur`, `angle` = число 0-359, `crop` = `square`. `qrCode` - PNG у форматі data URL, QR відкриває `url` трансформованого зображення. Кожен POST створює окремий збережений запис.

## Коментарі

`comment`: `{ id, photoId, text, author: { id, username, name, avatarUrl }, createdAt, updatedAt }`.

| Метод і шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|
| GET `/api/photos/:id/comments` | public | `page, limit` | 200 пагінований список |
| POST `/api/photos/:id/comments` | auth | `{ text }` (1-1000) | 201 `{ comment }` |
| PUT `/api/comments/:id` | автор | `{ text }` | 200 `{ comment }`, оновлює `updatedAt` |
| DELETE `/api/comments/:id` | staff | - | 204; автор свій коментар видаляти не може |

`text`: 1-1000 символів після обрізання пробілів. Чужий коментар не редагує ніхто, зокрема ADMIN (403). Коментарі видаляються разом зі світлиною.

## Рейтинг (MVP2)

| Метод і шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|
| POST `/api/photos/:id/ratings` | auth | `{ value }` (1-5) | 201 `{ rating, averageRating, ratingsCount }` |
| GET `/api/photos/:id/ratings` | staff | `page, limit` | 200 список оцінок |
| DELETE `/api/ratings/:id` | staff | - | 204 |

Одна оцінка на користувача (повторна: 409), власну світлину оцінювати не можна (403). Рейтинг світлини - середнє всіх оцінок.

## Пошук (MVP2)

`GET /api/search/photos`, доступ: auth.

| Параметр | Опис |
|---|---|
| `q` | ключове слово (опис і теги) |
| `tag` | точний тег |
| `sort` | `date` або `rating` |
| `order` | `asc` або `desc` (за замовчуванням `desc`) |
| `ratingMin` | мінімальний середній рейтинг, 1-5 |
| `dateFrom`, `dateTo` | діапазон дат додавання, `YYYY-MM-DD` |
| `username` | фільтр за автором, лише staff (для USER: 403) |
| `page`, `limit` | пагінація |

## Адміністрування

| Метод і шлях | Доступ | Тіло / query | Відповідь |
|---|---|---|---|
| GET `/api/admin/users` | staff | `q` (ім'я або email), `role`, `registeredFrom`, `registeredTo`, `page`, `limit` | 200 пагінований список користувачів |
| PATCH `/api/admin/users/:id/status` | ADMIN | `{ isActive: boolean }` | 200 `{ user }` |

Заборонено банити себе і іншого ADMIN (403).

## Мок-API для frontend

`npm run dev:mock` у `frontend/` піднімає ті самі ендпоінти з тестовими даними без backend. Додатково, лише в моку: `POST /api/dev/reset` (скидання даних) і `POST /api/dev/fail-next` (штучна помилка наступного запиту).
