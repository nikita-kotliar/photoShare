# Асети

- `icons/sprite.svg` - спрайт іконок (IcoMoon, `<symbol id="icon-назва">`), підключається при старті
- `images/` - растрові зображення (WebP + fallback), `@1x` і `@2x`
- Шрифти підключені через `@fontsource` у `src/styles/fonts.css`

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

