# Асети

- `icons/sprite.svg` - спрайт іконок (`<symbol id="icon-назва">`), підключається при старті
- `images/` - зображення: WebP `@1x` і `@2x` + fallback `@1x` (PNG або JPG), логотип і заглушка аватара в SVG
- `public/favicon.svg` - фавікон (знак з логотипа)
- Шрифти Poppins і Montserrat 400/500/600 (woff2) підключені через `@fontsource` у `src/styles/fonts.css`

## Іконки

```js
import { Icon } from '../components/icons.js';

Icon('search');
Icon('search', { size: 20, color: 'currentColor' });
Icon('send', { size: 32, color: '#fdfdfd', color2: '#24448a' });
```

- `size` - висота в px, ширина рахується за пропорціями іконки
- Іконки без кольорів у файлі беруть колір з `color` (або `currentColor`)
- `Send` має два кольори: `color` (коло) і `color2` (літачок)
- Перегляд усіх іконок: `/dev/icons` (тільки dev)

| Ім'я | Що це | Id у спрайті |
|---|---|---|
| `send` | відправити коментар, літачок у колі | Send |
| `backDesktop` | стрілка "Назад" desktop | arrowDeskTop |
| `backTablet` | стрілка "Назад" tablet | arrowTablet-1 |
| `backMobile` | стрілка "Назад" mobile | arrowMobile-1 |
| `selectArrow` | трикутник у списках | lsicon_arrow-down-outline-1 |
| `facebook`, `instagram`, `twitter`, `linkedin` | соцмережі | Vector-14, Vector-13, Vector-12, Vector-4 |
| `eyeOff` | пароль приховано | Vector-11 |
| `expand` | розгорнути зображення | uiw_arrows-alt |
| `qr` | QR-код | bi_qr-code |
| `star` | зірка рейтингу (контур) | Vector-10 |
| `search` | пошук | Vector-9 |
| `user` | користувач | Vector-8 |
| `role` | роль користувача | Role |
| `shieldPlus` | щит з плюсом (розбан) | Vector-7 |
| `pencil` | редагувати | material-symbols_edit-outline |
| `award` | нагорода із зіркою | material-symbols_award-star-outline |
| `block` | восьмикутник з мінусом | octicon_blocked-16 |
| `ban` | заборонено (бан) | Vector-6 |
| `trash` | видалити | Vector-5 |
| `calendar` | логотип календаря | Group-2 |
| `lock` | замок | material-symbols_edit-outline-1 |
| `starFilled` | зірка рейтингу (заповнена) | star-filled |
| `burger` | мобільне меню | burger |
| `close` | закрити меню | close |
| `exit` | вхід / вихід з акаунта | exit |
| `chevrons` | подвійна стрілка (кнопка реєстрації), два кольори | chevrons |
| `sort` | сортування | sort |
| `filter` | фільтри | filter |
| `checkbox` | розблокувати (адмінка) | checkbox |
| `arrowRight`, `arrowLeft` | стрілки в кнопках | arrow-right, arrow-left |
| `eye` | пароль показано | eye |

## Зображення

```html
<picture>
  <source type="image/webp" srcset="welcome@1x.webp 1x, welcome@2x.webp 2x" />
  <img src="welcome@1x.jpg" alt="" width="636" height="580" />
</picture>
```

| Файл | Де | Розмір @1x |
|---|---|---|
| `welcome@1x/@2x.webp`, `welcome@1x.jpg` | WelcomePage | 636x580 |
| `not-found@1x/@2x.webp`, `not-found@1x.png` | сторінка 404 | 456x464 |
| `logo.svg` | Header, Footer (світлий текст для темного фону) | 177x38 |
| `avatar-placeholder.svg` | аватар без фото | 96x96 |
