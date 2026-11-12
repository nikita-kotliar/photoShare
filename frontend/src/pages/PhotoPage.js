import '../styles/pages/photo.css';
import { commentsApi } from '../api/comments.js';
import { photosApi } from '../api/photos.js';
import { Button, setButtonLoading } from '../components/Button.js';
import { Icon } from '../components/icons.js';
import { isStaff } from '../components/navigation.js';
import { canManagePhoto, formatPhotoDate, plural, Stars } from '../components/PhotoCard.js';
import { TagList } from '../components/Tag.js';
import { bindForm } from '../validation/form.js';
import { schemas } from '../validation/index.js';
import { EFFECTS, transformationsPayload } from './UploadPage.js';
import avatarPlaceholder from '../assets/images/avatar-placeholder.svg';
import { withBase } from '../router/base.js';

const IMAGE_SIZE = 636;
const COMMENTS_LIMIT = 20;
const CONFIRM_LABEL = 'Точно видалити?';
const CONFIRM_TIMEOUT = 4000;
export const ANGLES = [0, 90, 180, 270];

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

// Рядок для помилок дій: порожній не займає місця, текст читається скрінрідером
function alertLine(className = '') {
  const line = el('p', `photo-page__error ${className}`.trim());
  line.setAttribute('role', 'alert');
  line.hidden = true;
  line.show = (message) => {
    line.textContent = message ?? '';
    line.hidden = !message;
  };
  return line;
}

// ====== Чисті функції (покриті тестами) ======

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

// Права так само, як на бекенді: редагує коментар лише автор, видаляє лише MODERATOR і ADMIN
export function commentPermissions(user, comment) {
  return {
    canEdit: Boolean(user && comment?.author && user.id === comment.author.id),
    canDelete: isStaff(user),
  };
}

// Світлиною (опис, видалення, посилання з трансформаціями) керують автор і ADMIN
export function photoPermissions(user, photo) {
  return {
    canManage: canManagePhoto(user, photo),
    canComment: Boolean(user),
  };
}

export function errorMessage(error, fallback = 'Щось пішло не так') {
  if (!error) return fallback;
  if (error.status === 0) return error.message || 'Немає з’єднання з сервером';
  if (error.status === 401) return 'Увійдіть, щоб виконати цю дію';
  if (error.status === 403) return error.message || 'Недостатньо прав для цієї дії';
  if (error.status === 404) return error.message || 'Не знайдено';
  if (error.status === 422) {
    const first = Object.values(error.fields ?? {})[0];
    return first || error.message || fallback;
  }
  return fallback;
}

export function transformationsLabel(transformations = {}) {
  const parts = [];
  if (transformations.effect) {
    parts.push(
      EFFECTS.find((e) => e.value === transformations.effect)?.label ?? transformations.effect,
    );
  }
  if (transformations.angle) parts.push(`${transformations.angle}°`);
  if (transformations.crop) parts.push('квадрат');
  return parts.join(' · ') || 'Оригінал';
}

// Об'єднує сторінки коментарів без дублікатів: після додавання чи видалення зсуваються offset-и
export function mergeComments(current, incoming) {
  const seen = new Set(current.map((c) => c.id));
  return [...current, ...incoming.filter((c) => !seen.has(c.id))];
}

// Видалення в два кліки: перший просить підтвердження, другий виконує дію
function confirmDelete(button, label, action) {
  let timer;
  const reset = () => {
    clearTimeout(timer);
    button.setAttribute('aria-label', label);
    button.classList.remove('photo-icon--confirm');
  };
  button.addEventListener('click', async () => {
    if (!button.classList.contains('photo-icon--confirm')) {
      button.setAttribute('aria-label', CONFIRM_LABEL);
      button.classList.add('photo-icon--confirm');
      timer = setTimeout(reset, CONFIRM_TIMEOUT);
      return;
    }
    reset();
    button.disabled = true;
    try {
      await action();
    } finally {
      button.disabled = false;
    }
  });
  button.addEventListener('blur', reset);
}

// Inline-форма редагування тексту (опис світлини, коментар)
function InlineEditForm({ name, value, label, schema, onSave, onCancel }) {
  const form = el('form', 'inline-edit');
  const field = el('div', 'field inline-edit__field');
  const input = el('textarea', 'inline-edit__input');
  input.name = name;
  input.id = `${name}-edit-${Math.random().toString(36).slice(2, 8)}`;
  input.rows = 3;
  input.maxLength = 1000;
  input.value = value ?? '';
  input.setAttribute('aria-label', label);
  field.append(input);

  const actions = el('div', 'inline-edit__actions');
  const save = Button({ text: 'Зберегти', type: 'submit', size: 'xxs' });
  const cancel = Button({ text: 'Скасувати', variant: 'secondary', size: 'xxs' });
  cancel.addEventListener('click', onCancel);
  actions.append(save, cancel);

  const error = alertLine();
  form.append(field, error, actions);

  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') onCancel();
  });

  bindForm(form, schema, {
    onSubmit: async (values, { setErrors }) => {
      error.show('');
      setButtonLoading(save, true, 'Збереження…');
      try {
        await onSave(values[name].trim());
      } catch (err) {
        if (err.status === 422 && err.fields?.[name]) setErrors({ [name]: err.fields[name] });
        else error.show(errorMessage(err, 'Не вдалося зберегти зміни'));
      } finally {
        setButtonLoading(save, false);
      }
    },
  });

  requestAnimationFrame(() => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
  return form;
}

// ====== QR-код і посилання з трансформаціями ======

function LinkForm({ onCreate }) {
  const form = el('form', 'link-form');
  form.noValidate = true;

  const effect = el('select', 'link-form__select');
  effect.name = 'effect';
  for (const item of EFFECTS) {
    const option = el('option', '', item.label);
    option.value = item.value;
    effect.append(option);
  }

  const angle = el('select', 'link-form__select');
  angle.name = 'angle';
  for (const value of ANGLES) {
    const option = el('option', '', value ? `${value}°` : 'Без повороту');
    option.value = String(value);
    angle.append(option);
  }

  const crop = el('input');
  crop.type = 'checkbox';
  crop.name = 'crop';

  const labeled = (text, control, className = 'link-form__field') => {
    const label = el('label', className);
    if (control.type === 'checkbox') label.append(control, el('span', '', text));
    else label.append(el('span', 'link-form__label', text), control);
    return label;
  };

  const submit = Button({ text: 'Створити посилання', type: 'submit', size: 'xxs' });
  const error = alertLine();
  const fields = el('div', 'link-form__fields');
  fields.append(
    labeled('Фільтр', effect),
    labeled('Поворот', angle),
    labeled('Квадратна обрізка', crop, 'link-form__check'),
  );
  form.append(
    el('p', 'link-form__title', 'Нове посилання з трансформаціями'),
    fields,
    error,
    submit,
  );

  form.addEventListener('change', () => error.show(''));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const transformations = transformationsPayload({
      effect: effect.value,
      angle: angle.value,
      crop: crop.checked,
    });
    if (!transformations) {
      error.show('Оберіть хоча б одну трансформацію');
      return;
    }
    setButtonLoading(submit, true, 'Створення…');
    try {
      await onCreate(transformations);
      form.reset();
    } catch (err) {
      error.show(errorMessage(err, 'Не вдалося створити посилання'));
    } finally {
      setButtonLoading(submit, false);
    }
  });
  return form;
}

function LinkView(link) {
  const view = el('div', 'qr-dialog__view');
  const img = el('img', 'qr-dialog__code');
  img.src = link.qrCode;
  img.alt = `QR-код посилання: ${transformationsLabel(link.transformations)}`;
  img.width = 270;
  img.height = 270;

  const url = el('a', 'qr-dialog__url', link.url);
  url.href = link.url;
  url.target = '_blank';
  url.rel = 'noopener';

  const actions = el('div', 'qr-dialog__actions');
  const download = Button({ text: 'Завантажити QR', href: link.qrCode });
  download.setAttribute('download', `photoshare-qr-${link.id}.png`);
  const copy = Button({ text: 'Скопіювати посилання', variant: 'secondary' });
  const copied = el('p', 'qr-dialog__copied');
  copied.setAttribute('aria-live', 'polite');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      copied.textContent = 'Посилання скопійовано';
    } catch {
      copied.textContent = 'Не вдалося скопіювати, виділіть посилання вручну';
    }
  });
  actions.append(download, copy);

  view.append(
    img,
    el('p', 'qr-dialog__caption', transformationsLabel(link.transformations)),
    url,
    actions,
    copied,
  );
  return view;
}

export function QrDialog(photo, { canCreate = false } = {}) {
  const dialog = el('dialog', 'qr-dialog');
  dialog.setAttribute('aria-labelledby', 'qr-dialog-title');
  const close = iconButton('qr-dialog__close', 'close', 'Закрити', () => dialog.close());
  const title = el('h2', 'qr-dialog__title', 'QR-код світлини');
  title.id = 'qr-dialog-title';

  const status = el('p', 'qr-dialog__status');
  status.setAttribute('role', 'status');
  const body = el('div', 'qr-dialog__body');
  const list = el('ul', 'qr-dialog__links');
  list.setAttribute('aria-label', 'Створені посилання');

  let links = [];
  let selectedId = null;
  let loaded = false;

  function render() {
    const selected = links.find((link) => link.id === selectedId) ?? links[0];
    body.replaceChildren();
    status.textContent = '';
    if (selected) body.append(LinkView(selected));
    else if (loaded)
      status.textContent = canCreate
        ? 'Посилань ще немає. Створіть перше за допомогою форми вище'
        : 'QR-код для цієї світлини ще не створено';

    list.replaceChildren();
    list.hidden = links.length < 2;
    for (const link of links) {
      const item = el('li');
      const button = el('button', 'qr-dialog__link', transformationsLabel(link.transformations));
      button.type = 'button';
      button.setAttribute('aria-pressed', String(link === selected));
      button.addEventListener('click', () => {
        selectedId = link.id;
        render();
      });
      item.append(button);
      list.append(item);
    }
  }

  async function load() {
    status.textContent = 'Завантаження посилань…';
    try {
      links = await photosApi.links(photo.id);
      loaded = true;
      status.textContent = '';
      render();
    } catch (err) {
      status.textContent = errorMessage(err, 'Не вдалося завантажити посилання');
      const retry = Button({ text: 'Спробувати ще', variant: 'secondary', size: 'xxs' });
      retry.addEventListener('click', load);
      body.replaceChildren(retry);
    }
  }

  dialog.append(close, title);
  if (canCreate) {
    dialog.append(
      LinkForm({
        onCreate: async (transformations) => {
          const link = await photosApi.createLink(photo.id, transformations);
          links = [link, ...links.filter((item) => item.id !== link.id)];
          selectedId = link.id;
          loaded = true;
          status.textContent = '';
          render();
        },
      }),
    );
  }
  dialog.append(status, body, list);

  // Не перезаписуємо dialog.open: це вбудована властивість <dialog>
  dialog.reveal = () => {
    dialog.showModal();
    if (!loaded) load();
  };
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  return dialog;
}

// ====== Коментарі ======

export function CommentItem(comment, { canEdit, canDelete, onSave, onDelete } = {}) {
  const item = el('li', 'comment');
  item.dataset.id = comment.id;
  const head = el('div', 'comment__head');
  const author = el('a', 'comment__author');
  author.href = withBase(`/users/${comment.author?.username ?? ''}`);
  author.append(
    avatar(comment.author, 54, 'comment__avatar'),
    el('span', 'comment__name', comment.author?.name || comment.author?.username || ''),
  );
  const created = el('p', 'comment__date');
  const time = el('time', '', formatCommentDate(comment.createdAt));
  time.dateTime = comment.createdAt;
  created.append(el('span', '', 'час створення'), time);
  head.append(author, created);

  const text = el('p', 'comment__text', comment.text);
  const error = alertLine();

  if (canEdit || canDelete) {
    const actions = el('div', 'comment__actions');
    if (canEdit) {
      const edit = iconButton('photo-icon', 'pencil', 'Редагувати коментар', () => {
        edit.disabled = true;
        const form = InlineEditForm({
          name: 'text',
          value: comment.text,
          label: 'Текст коментаря',
          schema: schemas.comment,
          onSave: (value) => onSave(value),
          onCancel: () => {
            form.replaceWith(text);
            edit.disabled = false;
            edit.focus();
          },
        });
        text.replaceWith(form);
      });
      actions.append(edit);
    }
    if (canDelete) {
      const remove = iconButton('photo-icon', 'trash', 'Видалити коментар');
      confirmDelete(remove, 'Видалити коментар', async () => {
        error.show('');
        try {
          await onDelete();
        } catch (err) {
          error.show(errorMessage(err, 'Не вдалося видалити коментар'));
        }
      });
      actions.append(remove);
    }
    head.append(actions);
  }

  item.append(head, text, error);
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
  const field = el('div', 'field');
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
  box.append(input, send);
  field.append(box);
  const error = alertLine();
  form.append(label, field, error);

  // Ctrl/Cmd + Enter надсилає коментар
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) form.requestSubmit();
  });

  bindForm(form, schemas.comment, {
    onSubmit: async (values, { setErrors }) => {
      error.show('');
      try {
        await onSubmit(values.text.trim());
        form.reset();
      } catch (err) {
        if (err.status === 422 && err.fields?.text) setErrors({ text: err.fields.text });
        else error.show(errorMessage(err, 'Не вдалося надіслати коментар'));
      }
    },
  });
  return form;
}

function CommentsSection(photo, user) {
  const section = el('section', 'photo-page__comments');
  section.setAttribute('aria-label', 'Коментарі');
  const list = el('ul', 'comment-list');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-busy', 'true');
  const status = el('p', 'comment-list__status', 'Завантаження коментарів…');
  status.setAttribute('role', 'status');
  const more = Button({ text: 'Показати ще', variant: 'secondary', size: 'xxs' });
  more.classList.add('comment-list__more');
  more.hidden = true;
  const retry = Button({ text: 'Спробувати ще', variant: 'secondary', size: 'xxs' });
  retry.classList.add('comment-list__more');
  retry.hidden = true;

  let comments = [];
  let total = 0;
  let page = 0;

  function item(comment) {
    const { canEdit, canDelete } = commentPermissions(user, comment);
    const node = CommentItem(comment, {
      canEdit,
      canDelete,
      onSave: async (text) => {
        const updated = await commentsApi.update(comment.id, text);
        comments = comments.map((c) => (c.id === updated.id ? updated : c));
        node.replaceWith(item(updated));
        list.querySelector(`[data-id="${updated.id}"] .photo-icon`)?.focus();
      },
      onDelete: async () => {
        await commentsApi.remove(comment.id);
        comments = comments.filter((c) => c.id !== comment.id);
        total = Math.max(0, total - 1);
        node.remove();
        renderMeta();
      },
    });
    return node;
  }

  function renderMeta() {
    more.hidden = comments.length >= total;
    if (!comments.length) status.textContent = 'Коментарів поки немає';
    else status.textContent = '';
    status.hidden = !status.textContent;
  }

  async function loadPage() {
    setButtonLoading(more, true, 'Завантаження…');
    retry.hidden = true;
    if (!comments.length) {
      status.hidden = false;
      status.textContent = 'Завантаження коментарів…';
    }
    try {
      const data = await commentsApi.list(photo.id, { page: page + 1, limit: COMMENTS_LIMIT });
      page += 1;
      total = data.total ?? data.items.length;
      const fresh = mergeComments(comments, data.items).slice(comments.length);
      comments = [...comments, ...fresh];
      list.append(...fresh.map(item));
      renderMeta();
    } catch (err) {
      status.hidden = false;
      status.textContent = errorMessage(err, 'Не вдалося завантажити коментарі');
      retry.hidden = false;
    } finally {
      list.removeAttribute('aria-busy');
      setButtonLoading(more, false);
    }
  }

  more.addEventListener('click', loadPage);
  retry.addEventListener('click', loadPage);

  if (user) {
    section.append(
      CommentForm({
        onSubmit: async (text) => {
          const comment = await commentsApi.create(photo.id, text);
          comments = [comment, ...comments];
          total += 1;
          list.prepend(item(comment));
          renderMeta();
        },
      }),
    );
  } else {
    const hint = el('p', 'comment-form__hint');
    const link = el('a', '', 'Увійдіть');
    link.href = withBase('/auth');
    hint.append(link, ', щоб залишити коментар');
    section.append(hint);
  }

  section.append(status, retry, list, more);
  loadPage();
  return section;
}

// ====== Інформація про світлину ======

function PhotoMeta(photo, { canManage, onQr, onSave }) {
  const meta = el('div', 'photo-page__meta');

  const authorRow = el('div', 'photo-page__row');
  const author = el('a', 'photo-page__author');
  author.href = withBase(`/users/${photo.author?.username ?? ''}`);
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
  const description = el('h2', 'photo-page__description', photo.description || 'Без опису');
  heading.append(
    description,
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

  // Перемикає опис у режим редагування; повертає false, якщо форма вже відкрита
  meta.editDescription = () => {
    if (!canManage || meta.querySelector('.inline-edit')) return false;
    const form = InlineEditForm({
      name: 'description',
      value: photo.description,
      label: 'Опис світлини',
      schema: schemas.photo,
      onSave,
      onCancel: () => {
        form.replaceWith(titleRow);
        meta.dispatchEvent(new CustomEvent('edit-end'));
      },
    });
    titleRow.replaceWith(form);
    return true;
  };
  return meta;
}

export function PhotoView(photo, { user, navigate } = {}) {
  const { canManage } = photoPermissions(user, photo);
  const root = el('article', 'photo-page container');

  const back = el('button', 'photo-page__back');
  back.type = 'button';
  back.append(Icon('backDesktop', { size: '1.125rem' }), el('span', '', 'Назад'));
  back.addEventListener('click', () => window.history.back());

  const title = el('h1', 'photo-page__title', 'Перегляд публікації');
  const tools = el('div', 'photo-page__tools');
  const toolsError = alertLine('photo-page__tools-error');

  const media = el('div', 'photo-page__media');
  const img = el('img', 'photo-page__img');
  img.src = photo.url;
  img.alt = photo.description || 'Світлина';
  img.width = IMAGE_SIZE;
  img.height = IMAGE_SIZE;
  img.fetchPriority = 'high';
  media.append(img);

  const qr = QrDialog(photo, { canCreate: canManage });
  let editButton = null;
  let meta = createMeta(photo);

  function createMeta(current) {
    const node = PhotoMeta(current, {
      canManage,
      onQr: () => qr.reveal(),
      onSave: async (description) => {
        const updated = await photosApi.update(current.id, { description });
        const next = { ...current, ...updated };
        img.alt = next.description || 'Світлина';
        const fresh = createMeta(next);
        node.replaceWith(fresh);
        meta = fresh;
        editButton?.removeAttribute('disabled');
        editButton?.focus();
      },
    });
    node.addEventListener('edit-end', () => {
      editButton?.removeAttribute('disabled');
      editButton?.focus();
    });
    return node;
  }

  if (canManage) {
    editButton = el('button', 'photo-page__edit');
    editButton.type = 'button';
    editButton.append(Icon('pencil', { size: '1rem' }), el('span', '', 'Редагувати опис'));
    editButton.addEventListener('click', () => {
      if (meta.editDescription()) editButton.disabled = true;
    });

    const remove = iconButton('photo-icon', 'trash', 'Видалити світлину');
    confirmDelete(remove, 'Видалити світлину', async () => {
      toolsError.show('');
      try {
        await photosApi.remove(photo.id);
        navigate?.('/home');
      } catch (err) {
        toolsError.show(errorMessage(err, 'Не вдалося видалити світлину'));
      }
    });
    tools.append(editButton, remove, toolsError);
  }

  root.append(back, title, tools, media, meta, CommentsSection(photo, user), qr);
  return root;
}

export default function PhotoPage({ params, store, navigate }) {
  const wrapper = el('div', 'photo-page-wrapper');
  const status = el('p', 'photo-page__status container', 'Завантаження світлини…');
  status.setAttribute('role', 'status');
  wrapper.append(status);
  wrapper.setAttribute('aria-busy', 'true');
  let alive = true;
  let photo = null;

  const render = () => {
    if (alive && photo)
      wrapper.replaceChildren(PhotoView(photo, { user: store.get().user, navigate }));
  };

  async function load() {
    try {
      photo = await photosApi.get(params.id);
      render();
    } catch (error) {
      if (!alive) return;
      status.textContent =
        error.status === 404
          ? 'Світлину не знайдено'
          : errorMessage(error, 'Не вдалося завантажити світлину');
      const actions = el('div', 'photo-page__status-actions');
      if (error.status !== 404) {
        const retry = Button({ text: 'Спробувати ще', variant: 'secondary', size: 's' });
        retry.addEventListener('click', () => {
          status.textContent = 'Завантаження світлини…';
          wrapper.replaceChildren(status);
          load();
        });
        actions.append(retry);
      }
      actions.append(Button({ text: 'До стрічки', href: '/home', size: 's' }));
      wrapper.replaceChildren(status, actions);
    } finally {
      wrapper.removeAttribute('aria-busy');
    }
  }

  // Вхід або вихід змінюють доступні дії, тому перебудовуємо сторінку
  const unsubscribe = store.subscribe(render, (s) => `${s.user?.id ?? ''}:${s.user?.role ?? ''}`);

  load();
  return {
    el: wrapper,
    destroy: () => {
      alive = false;
      unsubscribe();
    },
  };
}
