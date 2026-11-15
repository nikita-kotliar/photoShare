import '../styles/pages/home.css';
import '../styles/pages/profile.css';
import { authApi } from '../api/auth.js';
import { photosApi } from '../api/photos.js';
import { usersApi } from '../api/users.js';
import { Button } from '../components/Button.js';
import { Dropdown } from '../components/Dropdown.js';
import { Icon } from '../components/icons.js';
import { PhotoCard, plural } from '../components/PhotoCard.js';
import { pushToast } from '../store/index.js';
import avatarPlaceholder from '../assets/images/avatar-placeholder.svg';
import NotFoundPage from './NotFoundPage.js';
import { parsePage } from './HomePage.js';

export const PROFILE_LIMIT = 12;
const SVG_NS = 'http://www.w3.org/2000/svg';

export function formatJoinDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(2)}`;
}

export function photosCountText(count) {
  const n = count ?? 0;
  return `${n} ${plural(n, ['завантажене фото', 'завантажені фото', 'завантажених фото'])}`;
}

export function isOwnProfile(user, profile) {
  return Boolean(user && profile && user.username === profile.username);
}

export function profilePageHref(username, page) {
  const base = `/users/${encodeURIComponent(username)}`;
  return page > 1 ? `${base}?page=${page}` : base;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function dotsIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>';
  return svg;
}

function Skeleton() {
  const item = el('li', 'home__item');
  const card = el('div', 'home-skeleton');
  card.append(
    el('div', 'home-skeleton__media'),
    el('div', 'home-skeleton__line home-skeleton__line--wide'),
    el('div', 'home-skeleton__line'),
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

// Дії власника
function OwnerActions({ onLogout, navigate }) {
  const links = el('div', 'profile__actions');
  const edit = el('a', 'profile__action');
  edit.href = '/settings';
  edit.append(Icon('pencil', { size: '1.25rem' }), el('span', '', 'Редагувати свій профіль'));
  const logout = el('button', 'profile__action');
  logout.type = 'button';
  logout.append(Icon('exit', { size: '1.25rem' }), el('span', '', 'Вийти з акаунта'));
  logout.addEventListener('click', onLogout);
  links.append(edit, logout);

  const trigger = el('button', 'profile__more');
  trigger.type = 'button';
  trigger.setAttribute('aria-label', 'Дії з профілем');
  trigger.append(dotsIcon());
  const menu = Dropdown({
    trigger,
    label: 'Дії з профілем',
    selectable: false,
    options: [
      { value: 'settings', label: 'Редагувати профіль', icon: 'pencil' },
      { value: 'logout', label: 'Вийти з акаунта', icon: 'exit' },
    ],
    onChange: (value) => (value === 'logout' ? onLogout() : navigate('/settings')),
  });
  menu.classList.add('profile__menu');
  return { links, menu };
}

// Шапка профілю
function ProfileInfo(profile, { owner, onLogout, navigate }) {
  const info = el('div', 'profile__info');

  const avatar = el('img', 'profile__avatar');
  avatar.src = profile.avatarUrl || avatarPlaceholder;
  avatar.alt = '';
  avatar.width = 86;
  avatar.height = 86;

  const names = el('div', 'profile__names');
  names.append(
    el('p', 'profile__name', profile.name || profile.username),
    el('p', 'profile__username', `@${profile.username}`),
  );

  const meta = el('div', 'profile__meta');
  const joined = el('p', 'profile__joined');
  const time = el('time', '', formatJoinDate(profile.createdAt));
  time.dateTime = profile.createdAt ?? '';
  joined.append(el('span', '', 'Дата реєстрації'), time);
  meta.append(joined);

  if (owner) {
    const { links, menu } = OwnerActions({ onLogout, navigate });
    meta.append(links, menu);
  }

  info.append(avatar, names, meta);
  if (profile.bio) info.append(el('p', 'profile__bio', profile.bio));
  return info;
}

export default function ProfilePage({ params, query, store, navigate }) {
  const username = params.username;
  const page = parsePage(query.page);
  const controller = new AbortController();
  let menuDestroy = null;

  const root = el('section', 'profile container');
  root.setAttribute('aria-labelledby', 'profile-title');

  const back = el('button', 'profile__back');
  back.type = 'button';
  back.append(Icon('backDesktop', { size: '1.125rem' }), el('span', '', 'Назад'));
  back.addEventListener('click', () => window.history.back());

  const title = el('h1', 'profile__title', 'Профіль користувача');
  title.id = 'profile-title';

  const status = el('p', 'profile__status', 'Завантаження профілю…');
  status.setAttribute('role', 'status');
  root.append(back, title, status);

  async function logout() {
    try {
      await authApi.logout();
      navigate('/', { replace: true });
    } catch (error) {
      pushToast(error.message || 'Не вдалося вийти', 'error');
    }
  }

  // Світлини
  function PhotosSection(profile, owner) {
    const section = el('section', 'profile__photos');
    section.setAttribute('aria-labelledby', 'profile-photos-title');

    const head = el('div', 'profile__photos-head');
    const heading = el('div', 'profile__photos-heading');
    const h2 = el('h2', 'profile__photos-title', 'Фото');
    h2.id = 'profile-photos-title';
    heading.append(h2, el('p', 'profile__count', photosCountText(profile.photosCount)));
    head.append(heading);
    if (owner) {
      const add = Button({ text: 'Додати світлину', href: '/upload', className: 'profile__add' });
      add.append(el('span', 'profile__add-plus'));
      head.append(add);
    }

    const list = el('ul', 'home__grid');
    list.setAttribute('role', 'list');
    list.setAttribute('aria-busy', 'true');
    list.append(...Array.from({ length: 3 }, Skeleton));
    section.append(head, list);

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
        pushToast('Світлину видалено', 'success');
        loadPhotos();
      } catch (error) {
        button.disabled = false;
        pushToast(error.message || 'Не вдалося видалити світлину', 'error');
      }
    }

    function Pagination(pages) {
      const nav = el('nav', 'home__pagination');
      nav.setAttribute('aria-label', 'Сторінки світлин');
      const isFirst = page <= 1;
      const isLast = page >= pages;
      nav.append(
        Button({
          text: 'Назад',
          variant: 'secondary',
          href: isFirst ? undefined : profilePageHref(username, page - 1),
          arrowLeft: true,
          disabled: isFirst,
        }),
        Button({
          text: 'Далі',
          href: isLast ? undefined : profilePageHref(username, page + 1),
          arrowRight: true,
          disabled: isLast,
        }),
      );
      return nav;
    }

    async function loadPhotos() {
      let current = section.querySelector('.home__grid, .home__message');
      try {
        const data = await usersApi.photos(
          username,
          { page, limit: PROFILE_LIMIT },
          { signal: controller.signal },
        );
        if (data.pages > 0 && page > data.pages) {
          navigate(profilePageHref(username, data.pages), { replace: true });
          return;
        }
        section.querySelector('.home__pagination')?.remove();
        section.querySelector('.profile__count').textContent = photosCountText(data.total);

        if (data.items.length === 0) {
          const message = owner
            ? Message(
                'Тут поки немає світлин',
                'Додайте першу світлину',
                Button({ text: 'Додати світлину', href: '/upload' }),
              )
            : Message('Тут поки немає світлин', 'Користувач ще не додав жодної світлини');
          current.replaceWith(message);
          return;
        }

        const grid = el('ul', 'home__grid');
        grid.setAttribute('role', 'list');
        const user = store.get().user;
        grid.append(
          ...data.items.map((photo) => {
            const item = el('li', 'home__item');
            item.append(
              PhotoCard(photo, {
                user,
                headingLevel: 3,
                onEdit: () => navigate(`/photos/${photo.slug ?? photo.id}`),
                onDelete,
              }),
            );
            return item;
          }),
        );
        current.replaceWith(grid);
        current = grid;
        if (data.pages > 1) section.append(Pagination(data.pages));
      } catch (error) {
        if (error.name === 'AbortError') return;
        const retry = Button({ text: 'Спробувати ще', onClick: loadPhotos });
        current.replaceWith(
          Message('Не вдалося завантажити світлини', error.message || 'Спробуйте пізніше', retry),
        );
      }
    }

    loadPhotos();
    return section;
  }

  async function load() {
    try {
      const profile = await usersApi.profile(username, { signal: controller.signal });
      const owner = isOwnProfile(store.get().user, profile);
      const info = ProfileInfo(profile, { owner, onLogout: logout, navigate });
      const menu = info.querySelector('.profile__menu');
      menuDestroy = menu?.destroy ?? null;
      status.replaceWith(info);
      root.append(PhotosSection(profile, owner));
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (error.status === 404) {
        const notFound = NotFoundPage({ store });
        root.replaceChildren(notFound.el);
        root.classList.remove('container');
        menuDestroy = notFound.destroy;
        return;
      }
      status.textContent = error.message || 'Не вдалося завантажити профіль';
      status.append(' ', Button({ text: 'Спробувати ще', size: 'xs', onClick: retryLoad }));
    }
  }

  function retryLoad() {
    status.textContent = 'Завантаження профілю…';
    load();
  }

  load();
  return {
    el: root,
    destroy() {
      controller.abort();
      menuDestroy?.();
    },
  };
}
