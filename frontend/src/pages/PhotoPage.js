import '../styles/pages/photo.css';
import { commentsApi } from '../api/comments.js';
import { photosApi } from '../api/photos.js';
import { Button } from '../components/Button.js';
import { Icon } from '../components/icons.js';
import { formatPhotoDate, photoCardMode, plural, Stars } from '../components/PhotoCard.js';
import { TagList } from '../components/Tag.js';
import avatarPlaceholder from '../assets/images/avatar-placeholder.svg';

const IMAGE_SIZE = 636;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(className, icon, label, onClick) {
  const button = el('button', className);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(Icon(icon, { size: '1.25rem' }));
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

function avatar(author, size, className) {
  const img = el('img', className);
  img.src = author?.avatarUrl || avatarPlaceholder;
  img.alt = '';
  img.width = size;
  img.height = size;
  img.loading = 'lazy';
  return img;
}

export function formatCommentDate(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86400000);
  if (diff === 0) return `Сьогодні о ${time}`;
  if (diff === 1) return `Вчора о ${time}`;
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} о ${time}`;
}

// QR-код
export function QrDialog({ qrCode, url } = {}) {
  const dialog = el('dialog', 'qr-dialog');
  dialog.setAttribute('aria-labelledby', 'qr-dialog-title');
  const close = iconButton('qr-dialog__close', 'close', 'Закрити', () => dialog.close());
  const title = el('h2', 'qr-dialog__title', 'QR-код світлини');
  title.id = 'qr-dialog-title';
  dialog.append(close, title);

  if (qrCode) {
    const img = el('img', 'qr-dialog__code');
    img.src = qrCode;
    img.alt = 'QR-код посилання на світлину';
    img.width = 270;
    img.height = 270;
    const actions = el('div', 'qr-dialog__actions');
    const download = Button({ text: 'Завантажити QR', href: qrCode });
    download.setAttribute('download', 'photoshare-qr.png');
    actions.append(download, Button({ text: 'Скопіювати посилання', variant: 'secondary' }));
    actions.lastChild.addEventListener('click', () => navigator.clipboard?.writeText(url ?? ''));
    dialog.append(img, actions);
  } else {
    dialog.append(el('p', 'qr-dialog__empty', 'QR-код для цієї світлини ще не створено'));
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  return dialog;
}

// Коментарі
export function CommentItem(comment, { onEdit, onDelete } = {}) {
  const item = el('li', 'comment');
  const head = el('div', 'comment__head');
  const author = el('a', 'comment__author');
  author.href = `/users/${comment.author?.username ?? ''}`;
  author.append(
    avatar(comment.author, 54, 'comment__avatar'),
    el('span', 'comment__name', comment.author?.name || comment.author?.username || ''),
  );
  const created = el('p', 'comment__date');
  const time = el('time', '', formatCommentDate(comment.createdAt));
  time.dateTime = comment.createdAt;
  created.append(el('span', '', 'час створення'), time);
  head.append(author, created);

  if (onEdit || onDelete) {
    const actions = el('div', 'comment__actions');
    if (onEdit)
      actions.append(
        iconButton('photo-icon', 'pencil', 'Редагувати коментар', () => onEdit(comment)),
      );
    if (onDelete)
      actions.append(
        iconButton('photo-icon', 'trash', 'Видалити коментар', () => onDelete(comment)),
      );
    head.append(actions);
  }

  item.append(head, el('p', 'comment__text', comment.text));
  if (comment.updatedAt && comment.updatedAt !== comment.createdAt) {
    const updated = el('p', 'comment__updated');
    const time2 = el('time', '', formatCommentDate(comment.updatedAt));
    time2.dateTime = comment.updatedAt;
    updated.append('час оновлення ', time2);
    item.append(updated);
  }
  return item;
}

export function CommentForm({ onSubmit } = {}) {
  const form = el('form', 'comment-form');
  const label = el('label', 'comment-form__label', 'Залишити коментар');
  label.htmlFor = 'comment-text';
  const box = el('div', 'comment-form__box');
  const input = el('textarea', 'comment-form__input');
  input.id = 'comment-text';
  input.name = 'text';
  input.rows = 3;
  input.maxLength = 1000;
  const send = el('button', 'comment-form__send');
  send.type = 'submit';
  send.setAttribute('aria-label', 'Надіслати коментар');
  send.append(
    Icon('send', { size: '1.5rem', color: 'var(--color-primary)', color2: 'var(--color-bg)' }),
  );
  send.disabled = !onSubmit;
  box.append(input, send);
  form.append(label, box);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onSubmit?.(input.value.trim(), form);
  });
  return form;
}

// Інформація про світлину
function PhotoMeta(photo, { onQr }) {
  const meta = el('div', 'photo-page__meta');

  const authorRow = el('div', 'photo-page__row');
  const author = el('a', 'photo-page__author');
  author.href = `/users/${photo.author?.username ?? ''}`;
  author.append(
    avatar(photo.author, 36, 'photo-page__avatar'),
    el('span', '', photo.author?.name || photo.author?.username || ''),
  );
  const date = el('p', 'photo-page__date');
  const time = el('time', '', formatPhotoDate(photo.createdAt));
  time.dateTime = photo.createdAt ?? '';
  date.append('Опубліковано ', time);
  authorRow.append(author, date);

  const titleRow = el('div', 'photo-page__row photo-page__row--title');
  const heading = el('div', 'photo-page__heading');
  heading.append(
    el('h2', 'photo-page__description', photo.description || 'Без опису'),
    iconButton('photo-icon photo-icon--qr', 'qr', 'Показати QR-код', onQr),
  );
  const count = photo.ratingsCount ?? 0;
  const rating = el('p', 'photo-page__rating');
  rating.append(
    Stars(photo.averageRating),
    el(
      'span',
      'photo-page__rating-text',
      `${photo.averageRating ?? '-'} (${count} ${plural(count, ['оцінка', 'оцінки', 'оцінок'])})`,
    ),
  );
  titleRow.append(heading, rating);

  meta.append(authorRow, titleRow, TagList(photo.tags ?? []));
  return meta;
}

export function PhotoView(photo, { user, comments = [], onDelete, onComment } = {}) {
  const mode = photoCardMode(user, photo);
  const root = el('article', 'photo-page container');

  const back = el('button', 'photo-page__back');
  back.type = 'button';
  back.append(Icon('backDesktop', { size: '1.125rem' }), el('span', '', 'Назад'));
  back.addEventListener('click', () => window.history.back());

  const title = el('h1', 'photo-page__title', 'Перегляд публікації');
  const tools = el('div', 'photo-page__tools');
  if (mode !== 'guest') {
    const edit = el('a', 'photo-page__edit');
    edit.href = `/upload?edit=${photo.id}`;
    edit.append(Icon('pencil', { size: '1rem' }), el('span', '', 'Редагувати світлину'));
    tools.append(edit);
    if (onDelete) tools.append(iconButton('photo-icon', 'trash', 'Видалити світлину', onDelete));
  }

  const media = el('div', 'photo-page__media');
  const img = el('img', 'photo-page__img');
  img.src = photo.url;
  img.alt = photo.description || 'Світлина';
  img.width = IMAGE_SIZE;
  img.height = IMAGE_SIZE;
  img.fetchPriority = 'high';
  media.append(img);

  const qr = QrDialog();
  const meta = PhotoMeta(photo, { onQr: () => qr.showModal() });

  // Блок коментарів
  const section = el('section', 'photo-page__comments');
  section.setAttribute('aria-label', 'Коментарі');
  if (user) section.append(CommentForm({ onSubmit: onComment }));
  const list = el('ul', 'comment-list');
  list.setAttribute('role', 'list');
  if (comments.length) list.append(...comments.map((comment) => CommentItem(comment)));
  else list.append(el('li', 'comment-list__empty', 'Коментарів поки немає'));
  section.append(list);

  root.append(back, title, tools, media, meta, section, qr);
  return root;
}

export default function PhotoPage({ params, store, navigate }) {
  const wrapper = el('div', 'photo-page-wrapper');
  const status = el('p', 'photo-page__status container', 'Завантаження світлини…');
  status.setAttribute('role', 'status');
  wrapper.append(status);
  let alive = true;

  async function load() {
    try {
      const photo = await photosApi.get(params.id);
      const { items } = await commentsApi.list(photo.id, { limit: 50 });
      const user = store.get().user;
      const removeLabel = 'Точно видалити?';
      async function onDelete(event) {
        const button = event.currentTarget;
        if (button.getAttribute('aria-label') !== removeLabel) {
          button.setAttribute('aria-label', removeLabel);
          button.classList.add('photo-icon--confirm');
          return;
        }
        button.disabled = true;
        try {
          await photosApi.remove(photo.id);
          navigate('/home');
        } catch {
          button.disabled = false;
        }
      }
      if (alive) wrapper.replaceChildren(PhotoView(photo, { user, comments: items, onDelete }));
    } catch (error) {
      if (!alive) return;
      status.textContent =
        error.status === 404 ? 'Світлину не знайдено' : 'Не вдалося завантажити світлину';
      wrapper.replaceChildren(status, Button({ text: 'До стрічки', href: '/home', size: 's' }));
    }
  }

  load();
  return {
    el: wrapper,
    destroy: () => {
      alive = false;
    },
  };
}
