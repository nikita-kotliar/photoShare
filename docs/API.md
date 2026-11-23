# API

REST API на `/api` (на проді `/photoshare-api`). Повний опис зі схемами і прикладами - Swagger: `/api/docs`, специфікація `/api/docs.json`.

## Основне

- **Формат:** JSON; завантаження світлини - `multipart/form-data`.
- **Сесія:** JWT у httpOnly cookie (`token`, на проді `photoshare_token`), ставить сервер після реєстрації, входу або Google. Клієнт шле запити з `credentials: include`.
- **Ролі:** `USER`, `MODERATOR`, `ADMIN`; перший зареєстрований - `ADMIN`. У таблицях: `public` - без входу, `auth` - будь-хто з сесією, `owner` - власник, `staff` - модератор і адмін.
- **Пагінація:** `?page=1&limit=12` (`limit` до 50) → `{ items, total, page, limit, pages }`.
- **Помилки** однакові ([D-06](DECISIONS.md)): `{ "error": { "code", "message", "fields"? } }`.

| HTTP | code | Коли |
|---|---|---|
| 400 | `BAD_REQUEST` | некоректний JSON або multipart |
| 401 | `UNAUTHORIZED`, `TOKEN_INVALID`, `INVALID_CREDENTIALS` | немає сесії, токен недійсний, невірний email або пароль |
| 403 | `FORBIDDEN`, `USER_BANNED` | немає прав, акаунт заблоковано |
| 404 | `NOT_FOUND` | не знайдено |
| 409 | `CONFLICT` | зайнятий email чи юзернейм, повторна оцінка |
| 413 | `PAYLOAD_TOO_LARGE` | файл чи запит завеликий |
| 422 | `VALIDATION_ERROR` | помилки полів у `fields` |
| 429 | `RATE_LIMIT`, `AI_LIMIT` | забагато спроб входу чи реєстрації, вичерпано AI-ліміт |
| 503 | `AI_UNAVAILABLE` | AI недоступний |

## Об'єкти

- **user:** `{ id, username, name, email, role, isActive, avatarUrl, bio, googleLinked, createdAt }`
- **photo:** `{ id, slug, url, originalUrl, description, tags, colors: [{ hex, family }], author, averageRating, ratingsCount, commentsCount, myRating, createdAt, updatedAt }`. `originalUrl` - оригінал, лише якщо світлину трансформовано; `myRating` - лише з сесією.
- **comment:** `{ id, photoId, text, author, createdAt, updatedAt }`
- **author:** `{ id, username, name, avatarUrl }`

## Автентифікація

| Метод і шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|
| POST `/users` | public | `{ username, email, password, name? }` | 201 `{ user }` + cookie |
| POST `/sessions` | public | `{ email, password }` | 200 `{ user }` + cookie |
| GET `/sessions` | public | - | 200 `{ user }` або `{ user: null }` для гостя |
| DELETE `/sessions` | public | - | 204, токен у blacklist ([D-36](DECISIONS.md)) |
| GET `/auth/google` | public | - | 302 на Google ([D-57](DECISIONS.md)) |
| GET `/auth/google/callback` | public | - | 302 на `/home` з cookie або на `/auth?googleError=cancelled\|banned\|email_unverified\|unavailable` |

`username` 3-30 символів `[a-zA-Z0-9_.-]`, `password` 8-72, `name` 1-60. Вхід: 10 спроб за 15 хв, реєстрація: 20 за годину з однієї адреси. Забанений не входить; бан діє одразу на всі його сесії ([D-03](DECISIONS.md)).

## Користувачі

| Метод і шлях | Доступ | Тіло / query | Відповідь |
|---|---|---|---|
| GET `/users/me` | auth | - | 200 `{ user }` |
| PUT `/users/me` | auth | `{ name?, username?, email?, bio? }` | 200 `{ user }`; `bio` до 300, `""` очищає |
| GET `/users/:username` | public | - | 200 `{ user: { username, name, avatarUrl, bio, createdAt, photosCount } }` |
| GET `/users/:username/photos` | public | `page, limit` | 200 сторінка світлин |
| GET `/users/:username/achievements` | public | - | 200 `{ items: [{ code, earned, earnedAt }] }` |

Досягнення: `FIRST_PHOTO` (1 світлина), `TEN_PHOTOS` (10), `COMMENTATOR` (20 коментарів), `CRITIC` (50 оцінок), `FAVORITE` (середній рейтинг 4.5+ від 5 оцінок). Видаються один раз ([D-60](DECISIONS.md)); дії, що їх дають, повертають `newAchievements`.

## Світлини

| Метод і шлях | Доступ | Тіло / query | Відповідь |
|---|---|---|---|
| GET `/photos` | auth | `page, limit` | 200 стрічка, нові першими |
| POST `/photos` | auth | form-data: `image`, `description`, `tags` (JSON, до 5), `transformations` (JSON) | 201 `{ photo }` |
| GET `/photos/featured` | public | - | 200 `{ photo }` або `{ photo: null }` ([D-62](DECISIONS.md)) |
| GET `/photos/:idOrSlug` | public | - | 200 `{ photo }` |
| PUT `/photos/:id` | owner, ADMIN | `{ description, tags? }` | 200 `{ photo }` |
| DELETE `/photos/:id` | owner, ADMIN | - | 204, разом з коментарями, оцінками й посиланнями |
| POST `/photos/:id/links` | owner, ADMIN | `{ transformations }` | 201 `{ link: { id, url, qrCode, transformations, createdAt } }` |
| GET `/photos/:id/links` | public | - | 200 `{ items }` |
| POST `/ai/describe` | auth | form-data: `image` до 5 МБ | 200 `{ description, tags }` ([D-59](DECISIONS.md)) |

Зображення: JPEG, PNG, WEBP або GIF до 10 МБ (тип перевіряється за вмістом). Теги - до 30 символів, зберігаються малими літерами ([D-09](DECISIONS.md)). Трансформації: `effect` = `grayscale` / `sepia` / `blur`, `angle` 0-359, `crop` = `square`; оригінал не змінюється ([D-22](DECISIONS.md)). `qrCode` - PNG у data URL з посиланням на трансформоване зображення.

## Коментарі й оцінки

| Метод і шлях | Доступ | Тіло / query | Відповідь |
|---|---|---|---|
| GET `/photos/:id/comments` | public | `page, limit` | 200 сторінка коментарів |
| POST `/photos/:id/comments` | auth | `{ text }` 1-1000 | 201 `{ comment }` |
| PUT `/comments/:id` | автор | `{ text }` | 200 `{ comment }` |
| DELETE `/comments/:id` | staff | - | 204 |
| POST `/photos/:id/ratings` | auth | `{ value }` 1-5 | 201 `{ rating, averageRating, ratingsCount }` |
| GET `/photos/:id/ratings` | staff | `page, limit` | 200 сторінка оцінок |
| DELETE `/ratings/:id` | staff | - | 204 |

Чужий коментар не редагує ніхто, свій автор не видаляє ([D-16](DECISIONS.md)). Одна оцінка на людину (повторна - 409), свою світлину оцінити не можна, змінити оцінку не можна ([D-44](DECISIONS.md)). Середній рейтинг - з одним знаком після коми.

## Пошук

`GET /search/photos`, доступ auth → сторінка світлин.

| Параметр | Що робить |
|---|---|
| `q` | підрядок в описі або тегах, без урахування регістру |
| `tag` | точний тег |
| `color` | група кольору: `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `brown`, `black`, `gray`, `white` |
| `ratingMin` | мінімальний середній рейтинг 1-5 |
| `dateFrom`, `dateTo` | `YYYY-MM-DD`, UTC, обидва дні включно ([D-23](DECISIONS.md)) |
| `username` | автор, лише staff (для USER - 403) |
| `sort`, `order` | `date` або `rating`; `desc` (за замовчуванням) або `asc` |

Фільтри поєднуються через «і», порожній параметр не враховується ([D-47](DECISIONS.md)).

## Сповіщення

| Метод і шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|
| GET `/notifications` | auth | `page, limit` | 200 сторінка `{ id, type, read, actor, photo, data, createdAt }` |
| GET `/notifications/unread-count` | auth | - | 200 `{ count }` |
| POST `/notifications/read` | auth | `{ ids? }` | 200 `{ updated, unread }`; без `ids` - усі |

Типи: `COMMENT`, `RATING`, `ACHIEVEMENT`, `MODERATOR`. Про власні дії сповіщень немає ([D-58](DECISIONS.md)).

## Адміністрування

| Метод і шлях | Доступ | Тіло / query | Відповідь |
|---|---|---|---|
| GET `/admin/users` | staff | `q, role, registeredFrom, registeredTo, sort, order, page, limit` | 200 сторінка користувачів |
| PATCH `/admin/users/:id/status` | ADMIN | `{ isActive }` | 200 `{ user }` |
| PATCH `/admin/users/:id/role` | ADMIN | `{ role: "USER" \| "MODERATOR" }` | 200 `{ user }` ([D-51](DECISIONS.md)) |
| GET `/admin/comments/flagged` | staff | `page, limit` | 200 сторінка `{ commentId, category, reason, flaggedAt, comment }` ([D-61](DECISIONS.md)) |
| DELETE `/admin/comments/:id/flag` | staff | - | 204, коментар лишається |

Себе й іншого адміна банити чи змінювати їм роль не можна (403). Призначити `ADMIN` не можна (422).

## Службове

`GET /health` → `{ status: "ok", uptime }`. Мок-API для фронтенду повторює цей контракт ([frontend/README.md](../frontend/README.md)).
