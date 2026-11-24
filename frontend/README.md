# PhotoShare Frontend

Vite + vanilla JS. Структура: `src/pages`, `src/components`, `src/router`, `src/store`, `src/api`, `src/styles`, `mock/`.

Мок без затримки: `MOCK_DELAY=0 npm run dev:mock` (за замовчуванням 350 мс, щоб було видно стани завантаження).

## Що в мок-API

- 10 користувачів, 12 світлин з описами, тегами й палітрою, коментарі, оцінки, QR-посилання, сповіщення, досягнення
- Усі ендпоінти з `docs/API.md`, включно з входом через Google (повертає в акаунт `newbie`) і світлиною тижня; відновлення пароля - токен `aaaa…` (64 символи `a`)
- Дані в пам'яті: зміни живуть до перезапуску dev-сервера
- Сторінка `/dev/mock` показує стрічку і коментарі, `/dev/icons` - усі іконки

## Тестові акаунти

Пароль у всіх: `password123`

| Email | Роль | Особливість |
|---|---|---|
| admin@example.com | ADMIN | усе дозволено |
| valeria@example.com | MODERATOR | видаляє коментарі й оцінки, бачить `/admin` |
| oleksandr@example.com | USER | має 3 світлини, одна зі збереженими QR |
| ivan@example.com | USER | |
| anna@example.com, vlad@example.com, myroslav@example.com, dmytro@example.com | USER | |
| newbie@example.com | USER | без світлин і без аватара (порожні стани) |
| banned_user@example.com | USER | заблокований, вхід дає 403 |

## Дані для різних станів

| Що перевірити | Де |
|---|---|
| світлина без тегів | `/photos/7` |
| коротка і дуже довга назва/опис | `/photos/8`, `/photos/9` |
| світлина без оцінок | `/photos/8` |
| світлина без коментарів | `/photos/11` |
| 11 коментарів (пагінація) | `/photos/3` |
| відредагований коментар | `/photos/1`, `/photos/7` |
| збережені посилання і QR | `/photos/1` (автор oleksandr) |
| порожній профіль | `/users/newbie` |


## Правила

- Запити тільки через модулі `src/api/*`, не через `fetch` у сторінках
- Сторінка експортує `default function Page(ctx)` і повертає елемент або `{ el, destroy }`
- Бічні відступи сторінки: клас `.container` (16 / 36 / 72 px для mobile / tablet / desktop)
- Іконки: `Icon('search')`, довідник у `src/assets/README.md`
