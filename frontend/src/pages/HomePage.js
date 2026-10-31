import '../styles/pages/home.css';
import { photosApi } from '../api/photos.js';
import { Button } from '../components/Button.js';
import { PhotoCard } from '../components/PhotoCard.js';

export const FEED_LIMIT = 12;
const PRIORITY_CARDS = 3;

export function parsePage(value) {
  const page = Number.parseInt(value, 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function pageHref(page) {
  return page > 1 ? `/home?page=${page}` : '/home';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function Skeleton() {
  const item = el('li', 'home__item');
  const card = el('div', 'home-skeleton');
  card.append(
    el('div', 'home-skeleton__media'),
    el('div', 'home-skeleton__line home-skeleton__line--wide'),
    el('div', 'home-skeleton__line'),
    el('div', 'home-skeleton__line home-skeleton__line--short'),
  );
  item.append(card);
  return item;
}

function Message(title, text, action) {
  const box = el('div', 'home__message');
  box.append(el('p', 'home__message-title', title), el('p', 'home__message-text', text));
  if (action) box.append(action);
  return box;
}

export default function HomePage({ query, navigate, store }) {
  const page = parsePage(query.page);
  const controller = new AbortController();

  const root = el('section', 'home container');
  root.setAttribute('aria-labelledby', 'home-title');

  const title = el('h1', 'home__title');
  title.id = 'home-title';
  title.append(el('span', 'home__title-text', 'Відкривайте, діліться та надихайте кожним знімком'));

  const list = el('ul', 'home__grid');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-busy', 'true');
  list.append(...Array.from({ length: FEED_LIMIT }, Skeleton));

  const status = el('p', 'visually-hidden');
  status.setAttribute('role', 'status');
  status.textContent = 'Завантаження світлин';

  root.append(title, status, list);

  // Пагінація
  function Pagination(pages) {
    const nav = el('nav', 'home__pagination');
    nav.setAttribute('aria-label', 'Сторінки стрічки');
    const isFirst = page <= 1;
    const isLast = page >= pages;
    nav.append(
      Button({
        text: 'Назад',
        variant: 'secondary',
        href: isFirst ? undefined : pageHref(page - 1),
        arrowLeft: true,
        disabled: isFirst,
      }),
      Button({
        text: 'Далі',
        href: isLast ? undefined : pageHref(page + 1),
        arrowRight: true,
        disabled: isLast,
      }),
    );
    return nav;
  }

  // Видалення в два кліки
  async function onDelete(photo, event) {
    const button = event.currentTarget;
    const label = button.querySelector('.btn__text');
    if (button.dataset.confirm !== 'true') {
      button.dataset.confirm = 'true';
      label.textContent = 'Точно видалити?';
      button.addEventListener(
        'blur',
        () => {
          delete button.dataset.confirm;
          label.textContent = 'Видалити';
        },
        { once: true },
      );
      return;
    }
    button.disabled = true;
    try {
      await photosApi.remove(photo.id);
      load();
    } catch (error) {
      if (error.name !== 'AbortError') showError(error);
    }
  }

  function showError(error) {
    const retry = Button({ text: 'Спробувати ще', onClick: load });
    root.querySelector('.home__pagination')?.remove();
    list.replaceWith(
      Message('Не вдалося завантажити стрічку', error.message || 'Спробуйте пізніше', retry),
    );
    status.textContent = 'Помилка завантаження';
  }

  // Стрічка
  async function load() {
    const message = root.querySelector('.home__message');
    if (message) {
      list.replaceChildren(...Array.from({ length: FEED_LIMIT }, Skeleton));
      list.setAttribute('aria-busy', 'true');
      message.replaceWith(list);
    }
    try {
      const data = await photosApi.feed({ page, limit: FEED_LIMIT }, { signal: controller.signal });
      if (data.pages > 0 && page > data.pages) {
        navigate(pageHref(data.pages), { replace: true });
        return;
      }
      root.querySelector('.home__pagination')?.remove();
      list.removeAttribute('aria-busy');

      if (data.items.length === 0) {
        const upload = Button({ text: 'Додати світлину', href: '/upload' });
        list.replaceWith(Message('Тут поки немає світлин', 'Додайте першу світлину', upload));
        status.textContent = 'Світлин немає';
        return;
      }

      const user = store.get().user;
      list.replaceChildren(
        ...data.items.map((photo, i) => {
          const item = el('li', 'home__item');
          item.append(
            PhotoCard(photo, {
              user,
              headingLevel: 2,
              priority: i < PRIORITY_CARDS,
              onEdit: () => navigate(`/photos/${photo.slug ?? photo.id}`),
              onDelete,
            }),
          );
          return item;
        }),
      );
      status.textContent = `Сторінка ${data.page} з ${data.pages}`;
      if (data.pages > 1) root.append(Pagination(data.pages));
    } catch (error) {
      if (error.name !== 'AbortError') showError(error);
    }
  }

  load();
  return { el: root, destroy: () => controller.abort() };
}
