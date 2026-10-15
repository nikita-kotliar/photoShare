import { authApi } from '../../api/auth.js';
import { photosApi } from '../../api/photos.js';
import { commentsApi } from '../../api/comments.js';

const ACCOUNTS = [
  ['admin@example.com', 'ADMIN'],
  ['valeria@example.com', 'MODERATOR'],
  ['oleksandr@example.com', 'USER'],
  ['ivan@example.com', 'USER'],
  ['newbie@example.com', 'USER, без світлин'],
  ['banned_user@example.com', 'заблокований'],
];

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

export default function MockPage(ctx) {
  const root = el('section', { className: 'container' });
  root.style.paddingBlock = 'var(--space-6)';

  const status = el('p');
  const accounts = el('div');
  accounts.style.cssText =
    'display:flex;flex-wrap:wrap;gap:var(--space-2);margin-block:var(--space-4)';
  const list = el('div');
  list.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--space-5)';

  function showUser() {
    const user = ctx.store.get().user;
    status.textContent = user
      ? `Увійшов: ${user.name} (${user.role})`
      : 'Не авторизований. Оберіть тестовий акаунт (пароль: password123).';
  }

  for (const [email, label] of ACCOUNTS) {
    const button = el('button', { type: 'button', textContent: `${email} - ${label}` });
    button.addEventListener('click', async () => {
      try {
        await authApi.login({ email, password: 'password123' });
      } catch (error) {
        status.textContent = `${error.status} ${error.code}: ${error.message}`;
        return;
      }
      showUser();
      await load();
    });
    accounts.append(button);
  }

  const logout = el('button', { type: 'button', textContent: 'Вийти' });
  logout.addEventListener('click', async () => {
    await authApi.logout();
    showUser();
    list.replaceChildren();
    list.append(el('p', {}, 'Стрічка доступна лише авторизованим.'));
  });
  accounts.append(logout);

  async function load() {
    list.replaceChildren(el('p', {}, 'Завантаження...'));
    try {
      const feed = await photosApi.feed({ limit: 12 });
      list.replaceChildren(...feed.items.map(card));
    } catch (error) {
      list.replaceChildren(el('p', {}, `${error.status} ${error.code}: ${error.message}`));
    }
  }

  function card(photo) {
    const image = el('img', { src: photo.url, alt: photo.description, loading: 'lazy' });
    image.style.cssText =
      'width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius-m)';

    const rating =
      photo.averageRating === null
        ? 'без оцінок'
        : `${photo.averageRating} (${photo.ratingsCount})`;
    const meta = el('p', {
      textContent: `${photo.author.name} · рейтинг: ${rating} · коментарів: ${photo.commentsCount}`,
    });
    meta.style.fontSize = 'var(--fs-small)';

    const tags = el('p', {
      textContent: photo.tags.length ? photo.tags.map((t) => `#${t}`).join(' ') : '(без тегів)',
    });
    tags.style.cssText = 'font-size:var(--fs-small);color:var(--color-muted)';

    const comments = el('div');
    const toggle = el('button', { type: 'button', textContent: 'Показати коментарі' });
    toggle.addEventListener('click', async () => {
      const result = await commentsApi.list(photo.id, { limit: 3 });
      comments.replaceChildren(
        ...result.items.map((c) => el('p', { textContent: `${c.author.name}: ${c.text}` })),
      );
      if (result.items.length === 0) comments.append(el('p', {}, 'Коментарів немає.'));
    });

    const box = el(
      'article',
      {},
      image,
      el('p', { textContent: photo.description }),
      tags,
      meta,
      toggle,
      comments,
    );
    box.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-2)';
    return box;
  }

  root.append(
    el('h1', {}, 'Тестові дані (мок-API)'),
    el('p', {}, 'Сторінка лише для розробки: перевірка, що API і дані працюють.'),
    status,
    accounts,
    list,
  );
  showUser();
  if (ctx.store.get().user) load();
  return root;
}
