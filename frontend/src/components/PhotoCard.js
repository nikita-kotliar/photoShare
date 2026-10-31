import { Button } from './Button.js';
import { Icon } from './icons.js';
import { TagList } from './Tag.js';
import avatarPlaceholder from '../assets/images/avatar-placeholder.svg';

const MANAGER_ROLES = ['ADMIN'];

export function canManagePhoto(user, photo) {
  if (!user || !photo) return false;
  return user.id === photo.author?.id || MANAGER_ROLES.includes(user.role);
}

export function formatPhotoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function plural(count, [one, few, many]) {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function Stars(value) {
  const list = el('span', 'photo-card__stars');
  for (let i = 0; i < 5; i += 1) {
    const fill = Math.min(Math.max((value ?? 0) - i, 0), 1);
    const star = el('span', 'photo-card__star');
    star.style.setProperty('--fill', `${fill * 100}%`);
    const filled = el('span', 'photo-card__star-fill');
    filled.append(Icon('starFilled', { size: 22 }));
    star.append(Icon('starFilled', { size: 22 }), filled);
    list.append(star);
  }
  return list;
}

function metaRow(label, value) {
  const row = el('p', 'photo-card__row');
  row.append(el('span', '', label), el('span', '', value));
  return row;
}

export function PhotoCard(photo, { user, onEdit, onDelete } = {}) {
  const href = `/photos/${photo.slug ?? photo.id}`;
  const title = photo.description || 'Без назви';
  const card = el('article', 'photo-card');

  // Зображення
  const media = el('a', 'photo-card__media');
  media.href = href;
  const img = el('img', 'photo-card__img');
  img.src = photo.url;
  img.alt = title;
  img.loading = 'lazy';
  img.decoding = 'async';
  const expand = el('span', 'photo-card__expand');
  expand.append(Icon('expand', { size: 28 }));
  media.append(img, expand);

  // Автор
  const author = el('a', 'photo-card__author');
  author.href = `/users/${photo.author?.username ?? ''}`;
  const avatar = el('img', 'photo-card__avatar');
  avatar.src = photo.author?.avatarUrl || avatarPlaceholder;
  avatar.alt = '';
  avatar.loading = 'lazy';
  author.append(
    avatar,
    el('span', 'photo-card__name', photo.author?.name || photo.author?.username || ''),
  );

  const heading = el('h3', 'photo-card__title', title);

  // Рейтинг і дати
  const ratingsCount = photo.ratingsCount ?? 0;
  const rating = el('p', 'photo-card__row');
  rating.append(
    Stars(photo.averageRating),
    el(
      'span',
      'photo-card__rating',
      `${photo.averageRating ?? '-'} (${ratingsCount} ${plural(ratingsCount, ['оцінка', 'оцінки', 'оцінок'])})`,
    ),
  );
  rating.setAttribute('aria-label', `Рейтинг ${photo.averageRating ?? 'відсутній'}`);

  const commentsCount = photo.commentsCount ?? 0;

  // Кнопки
  const actions = el('div', 'photo-card__actions');
  actions.append(Button({ text: 'Детальніше', href }));
  if (canManagePhoto(user, photo)) {
    actions.append(
      Button({ text: 'Редагувати', variant: 'secondary', onClick: () => onEdit?.(photo) }),
      Button({ text: 'Видалити', variant: 'danger', onClick: () => onDelete?.(photo) }),
    );
  }

  card.append(
    media,
    author,
    heading,
    TagList(photo.tags ?? []),
    rating,
    metaRow('Коментарі', String(commentsCount)),
    metaRow('Опубліковано', formatPhotoDate(photo.createdAt)),
    actions,
  );
  card.classList.toggle('photo-card--manage', actions.children.length > 1);
  return card;
}
