import '../styles/components/lightbox.css';
import { Button } from './Button.js';
import { Icon } from './icons.js';
import { markHero, reducedMotion } from './motion.js';
import { formatPhotoDate } from './PhotoCard.js';
import { Rating } from './Rating.js';
import { TagList } from './Tag.js';
import avatarPlaceholder from '../assets/images/avatar-placeholder.svg';
import { withBase } from '../router/base.js';

const SWIPE_DISTANCE = 50;

export function stepIndex(index, delta, length) {
  const next = index + delta;
  return next >= 0 && next < length ? next : index;
}

export function counterText(index, length) {
  return `${index + 1} з ${length}`;
}

export function swipeDelta(dx, dy) {
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function navButton(direction, label) {
  const button = el('button', `lightbox__nav lightbox__nav--${direction}`);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(Icon(direction === 'prev' ? 'arrowLeft' : 'arrowRight', { size: '1.5rem' }));
  return button;
}

// Перегляд світлини на весь екран
export function Lightbox({ user, onRated } = {}) {
  const dialog = el('dialog', 'lightbox');
  dialog.setAttribute('aria-labelledby', 'lightbox-title');

  const panel = el('div', 'lightbox__panel');
  const close = el('button', 'lightbox__close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрити');
  close.append(Icon('close', { size: '1rem' }));

  const media = el('div', 'lightbox__media');
  const img = el('img', 'lightbox__img');
  img.decoding = 'async';
  const prev = navButton('prev', 'Попередня світлина');
  const next = navButton('next', 'Наступна світлина');
  const counter = el('p', 'lightbox__counter');
  counter.setAttribute('aria-live', 'polite');
  media.append(img, prev, next, counter);

  const info = el('div', 'lightbox__info');
  panel.append(media, info, close);
  dialog.append(panel);

  let items = [];
  let index = 0;

  // Вміст
  function render() {
    const photo = items[index];
    const title = photo.description || 'Без назви';
    img.src = photo.url;
    img.alt = title;
    img.classList.remove('lightbox__img--in');
    void img.offsetWidth;
    img.classList.add('lightbox__img--in');

    const author = el('a', 'lightbox__author');
    author.href = withBase(`/users/${photo.author?.username ?? ''}`);
    const avatar = el('img', 'lightbox__avatar');
    avatar.src = photo.author?.avatarUrl || avatarPlaceholder;
    if (!photo.author?.avatarUrl) avatar.classList.add('avatar-placeholder');
    avatar.alt = '';
    avatar.width = 48;
    avatar.height = 48;
    author.append(
      avatar,
      el('span', 'lightbox__name', photo.author?.name || photo.author?.username || ''),
    );

    const heading = el('h2', 'lightbox__title', title);
    heading.id = 'lightbox-title';

    const rating = Rating(photo, {
      user,
      textClass: 'lightbox__rating-text',
      onRated: (updated) => {
        items[index] = { ...items[index], ...updated };
        onRated?.(items[index]);
      },
    });

    const date = el('p', 'lightbox__date');
    const time = el('time', '', formatPhotoDate(photo.createdAt));
    time.dateTime = photo.createdAt ?? '';
    date.append('Опубліковано ', time);

    const more = Button({ text: 'Детальніше', href: `/photos/${photo.slug ?? photo.id}` });
    more.classList.add('lightbox__more');
    more.addEventListener('click', () => markHero(img, photo.id));

    info.replaceChildren(author, heading, TagList(photo.tags ?? []), rating, date, more);

    prev.disabled = index === 0;
    next.disabled = index === items.length - 1;
    prev.hidden = items.length < 2;
    next.hidden = items.length < 2;
    counter.hidden = items.length < 2;
    counter.textContent = counterText(index, items.length);
  }

  function go(delta) {
    const target = stepIndex(index, delta, items.length);
    if (target === index) return;
    index = target;
    render();
  }

  // Плавне збільшення від картки
  function zoomFrom(origin) {
    panel.style.transformOrigin = '';
    if (!origin || reducedMotion()) return;
    const box = panel.getBoundingClientRect();
    const x = origin.left + origin.width / 2 - box.left;
    const y = origin.top + origin.height / 2 - box.top;
    panel.style.transformOrigin = `${Math.round(x)}px ${Math.round(y)}px`;
  }

  function showPhoto(list, start = 0, origin = null) {
    items = [...list];
    index = Math.min(Math.max(start, 0), items.length - 1);
    render();
    dialog.showModal();
    zoomFrom(origin);
    close.focus();
  }

  close.addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.target.closest?.('input, textarea')) return;
    if (event.key === 'ArrowLeft') go(-1);
    if (event.key === 'ArrowRight') go(1);
  });

  // Свайп на телефоні
  let touch = null;
  media.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') touch = { x: event.clientX, y: event.clientY };
  });
  media.addEventListener('pointerup', (event) => {
    if (!touch) return;
    go(swipeDelta(event.clientX - touch.x, event.clientY - touch.y));
    touch = null;
  });

  return Object.assign(dialog, { showPhoto, destroy: () => dialog.remove() });
}
