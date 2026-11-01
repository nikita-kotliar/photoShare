import { Button } from './Button.js';
import { Icon } from './icons.js';
import { TagList } from './Tag.js';
import avatarPlaceholder from '../assets/images/avatar-placeholder.svg';

const ADMIN_ROLES = ['ADMIN'];
const IMAGE_SIZE = 416;
const AVATAR_SIZE = 70;

export function photoCardMode(user, photo) {
  if (!user || !photo) return 'guest';
  if (user.id === photo.author?.id) return 'owner';
  if (ADMIN_ROLES.includes(user.role)) return 'admin';
  return 'guest';
}

export function canManagePhoto(user, photo) {
  return photoCardMode(user, photo) !== 'guest';
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
  list.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i += 1) {
    const fill = Math.min(Math.max((value ?? 0) - i, 0), 1);
    const star = el('span', 'photo-card__star');
    star.style.setProperty('--fill', `${fill * 100}%`);
    const filled = el('span', 'photo-card__star-fill');
    filled.append(Icon('starFilled', { size: '1.375rem' }));
    star.append(Icon('starFilled', { size: '1.375rem' }), filled);
    list.append(star);
  }
  return list;
}

function metaRow(label, value, valueTag = 'span') {
  const row = el('p', 'photo-card__row');
  row.append(el('span', '', label), el(valueTag, '', value));
  return row;
}

export function PhotoCard(
  photo,
  { user, onEdit, onDelete, headingLevel = 3, priority = false } = {},
) {
  const href = `/photos/${photo.slug ?? photo.id}`;
  const title = photo.description || 'Без назви';
  const mode = photoCardMode(user, photo);
  const card = el('article', `photo-card photo-card--${mode}`);

  // Зображення
  const media = el('a', 'photo-card__media');
  media.href = href;
  media.setAttribute('aria-label', `Відкрити світлину «${title}»`);
  const img = el('img', 'photo-card__img');
  img.src = photo.url;
  img.alt = title;
  img.width = IMAGE_SIZE;
  img.height = IMAGE_SIZE;
  img.decoding = 'async';
  if (priority) img.fetchPriority = 'high';
  else img.loading = 'lazy';
  const expand = el('span', 'photo-card__expand');
  expand.append(Icon('expand', { size: '1.75rem' }));
  media.append(img, expand);

  // Автор
  const author = el('a', 'photo-card__author');
  author.href = `/users/${photo.author?.username ?? ''}`;
  const avatar = el('img', 'photo-card__avatar');
  avatar.src = photo.author?.avatarUrl || avatarPlaceholder;
  avatar.alt = '';
  avatar.width = AVATAR_SIZE;
  avatar.height = AVATAR_SIZE;
  avatar.decoding = 'async';
  if (!priority) avatar.loading = 'lazy';
  author.append(
    avatar,
    el('span', 'photo-card__name', photo.author?.name || photo.author?.username || ''),
  );

  const level = Math.min(Math.max(headingLevel, 2), 6);
  const heading = el(`h${level}`, 'photo-card__title', title);

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

  const published = metaRow('Опубліковано', formatPhotoDate(photo.createdAt), 'time');
  published.lastChild.dateTime = photo.createdAt ?? '';

  // Кнопки
  const actions = el('div', 'photo-card__actions');
  if (mode === 'owner') {
    actions.append(Button({ text: 'Редагувати', onClick: () => onEdit?.(photo) }));
  } else {
    actions.append(Button({ text: 'Детальніше', href }));
  }
  if (mode !== 'guest') {
    actions.append(
      Button({
        text: 'Видалити',
        variant: 'danger',
        onClick: (event) => onDelete?.(photo, event),
      }),
    );
  }

  card.append(
    media,
    author,
    heading,
    TagList(photo.tags ?? []),
    rating,
    metaRow('Коментарі', String(photo.commentsCount ?? 0)),
    published,
    actions,
  );
  return card;
}
