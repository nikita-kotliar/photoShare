import '../styles/pages/home.css';
import '../styles/pages/admin.css';
import { adminApi } from '../api/admin.js';
import { Button, setButtonLoading } from '../components/Button.js';
import { Calendar } from '../components/Calendar.js';
import { Dropdown } from '../components/Dropdown.js';
import { Icon } from '../components/icons.js';
import { SearchInput } from '../components/SearchInput.js';
import { ROLE_ICONS, UserRow } from '../components/UserRow.js';
import { withBase } from '../router/base.js';
import { pushToast } from '../store/index.js';
import { parsePage } from './HomePage.js';

export const ADMIN_LIMIT = 8;
const SEARCH_DELAY = 400;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const SORTS = [
  { value: 'name', label: 'А–Я', query: { sort: 'name', order: 'asc' } },
  { value: '-name', label: 'Я–А', query: { sort: 'name', order: 'desc' } },
  { value: 'date', label: 'Дата реєстрації', query: {} },
];

export const ROLE_FILTERS = [
  { value: 'USER', label: 'Лише користувачі' },
  { value: 'MODERATOR', label: 'Лише модератори' },
  { value: 'ADMIN', label: 'Лише адміністратори' },
];

const DEFAULTS = { q: '', role: '', from: '', to: '', sort: 'date', page: 1 };

function validDate(value) {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value))
    ? value
    : '';
}

// Стан фільтрів з адреси сторінки: некоректне значення ігноруємо, а не показуємо помилку
export function parseAdminQuery(query = {}) {
  let from = validDate(query.from);
  let to = validDate(query.to);
  if (from && to && from > to) [from, to] = [to, from];
  return {
    q: String(query.q ?? '')
      .trim()
      .slice(0, 100),
    role: ROLE_FILTERS.some((r) => r.value === query.role) ? query.role : '',
    from,
    to,
    sort: SORTS.some((s) => s.value === query.sort) ? query.sort : 'date',
    page: parsePage(query.page),
  };
}

// Параметри GET /api/admin/users (порожні client.js не надсилає)
export function adminApiQuery(state, limit = ADMIN_LIMIT) {
  const sort = SORTS.find((s) => s.value === state.sort) ?? SORTS[2];
  return {
    q: state.q,
    role: state.role,
    registeredFrom: state.from,
    registeredTo: state.to,
    ...sort.query,
    page: state.page,
    limit,
  };
}

// Адреса сторінки без значень за замовчуванням: /admin?q=...&page=2
export function adminHref(state) {
  const params = new URLSearchParams();
  for (const key of ['q', 'role', 'from', 'to', 'sort', 'page']) {
    const value = state[key];
    if (value !== undefined && value !== '' && value !== DEFAULTS[key]) params.set(key, value);
  }
  const search = params.toString();
  return search ? `/admin?${search}` : '/admin';
}

export function hasFilters(state) {
  return Boolean(state.q || state.role || state.from || state.to);
}

export function dateRangeLabel({ from, to } = {}) {
  const short = (value) => {
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y.slice(2)}`;
  };
  if (!from && !to) return '';
  if (from && to) return from === to ? short(from) : `${short(from)} – ${short(to)}`;
  return from ? `з ${short(from)}` : `до ${short(to)}`;
}

// Замінює користувача в списку після бану чи розбану, решту лишає як є
export function replaceUser(items, updated) {
  return items.map((user) => (user.id === updated.id ? { ...user, ...updated } : user));
}

export function confirmText(user, action) {
  const who = user.name || user.username;
  return action === 'ban'
    ? {
        title: 'Забанити користувача?',
        text: `${who} (@${user.username}) не зможе увійти, а поточна сесія завершиться на наступному запиті.`,
        button: 'Забанити',
        done: `${who} заблоковано`,
      }
    : {
        title: 'Розблокувати користувача?',
        text: `${who} (@${user.username}) знову зможе увійти і користуватися сайтом.`,
        button: 'Розблокувати',
        done: `${who} розблоковано`,
      };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function toolButton(icon, label, className = '') {
  const button = el('button', `admin__tool ${className}`.trim());
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(Icon(icon, { size: '1.25rem' }));
  return button;
}

function Skeleton() {
  const item = el('li', 'user-row user-row--skeleton');
  item.setAttribute('aria-hidden', 'true');
  item.append(el('span', 'user-row__avatar'), el('span', 'user-row__line'));
  return item;
}

// Підтвердження бану і розбану. Повертає dialog з методом ask(user, action) -> Promise<boolean>
function ConfirmDialog() {
  const dialog = el('dialog', 'admin-dialog');
  dialog.setAttribute('aria-labelledby', 'admin-dialog-title');
  dialog.setAttribute('aria-describedby', 'admin-dialog-text');

  const close = el('button', 'admin-dialog__close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрити');
  close.append(Icon('close', { size: '1rem' }));
  const title = el('h2', 'admin-dialog__title');
  title.id = 'admin-dialog-title';
  const text = el('p', 'admin-dialog__text');
  text.id = 'admin-dialog-text';
  const actions = el('div', 'admin-dialog__actions');
  dialog.append(close, title, text, actions);

  let pending = null;
  close.addEventListener('click', () => dialog.close('cancel'));
  dialog.addEventListener('close', () => {
    pending?.(dialog.returnValue === 'confirm');
    pending = null;
  });

  function ask(user, action, run) {
    const copy = confirmText(user, action);
    title.textContent = copy.title;
    text.textContent = copy.text;
    const cancel = Button({ text: 'Скасувати', variant: 'secondary', size: 'xs' });
    cancel.addEventListener('click', () => dialog.close('cancel'));
    const confirm = Button({
      text: copy.button,
      variant: action === 'ban' ? 'danger' : 'primary',
      size: 'xs',
    });
    confirm.addEventListener('click', async () => {
      setButtonLoading(confirm, true);
      cancel.disabled = true;
      const ok = await run();
      setButtonLoading(confirm, false);
      cancel.disabled = false;
      if (ok) dialog.close('confirm');
    });
    actions.replaceChildren(cancel, confirm);
    dialog.returnValue = '';
    dialog.showModal();
    cancel.focus();
    return new Promise((resolve) => {
      pending = resolve;
    });
  }

  return Object.assign(dialog, { ask });
}

export default function AdminPage({ query, store }) {
  let state = parseAdminQuery(query);
  let items = [];
  let controller = null;
  let searchTimer = null;
  const cleanups = [];

  const root = el('section', 'admin container');
  root.setAttribute('aria-labelledby', 'admin-title');

  const back = el('button', 'admin__back');
  back.type = 'button';
  back.append(Icon('backDesktop', { size: '1.125rem' }), el('span', '', 'Назад'));
  back.addEventListener('click', () => window.history.back());

  const title = el('h1', 'admin__title', 'Управління користувачами');
  title.id = 'admin-title';

  // Пошук за ім'ям, username або email (поле q в API)
  const search = SearchInput({
    value: state.q,
    placeholder: "Пошук користувачів за ім'ям, поштою",
    label: "Пошук користувачів за ім'ям, юзернеймом або поштою",
    onSearch: (q) => update({ q }),
  });
  search.classList.add('admin__search');
  search.input.maxLength = 100;
  search.input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = search.input.value.trim();
      if (q !== state.q) update({ q });
    }, SEARCH_DELAY);
  });

  // Фільтр ролі: кнопка вмикає роль, повторний клік вимикає
  const roles = el('div', 'admin__roles');
  roles.setAttribute('role', 'group');
  roles.setAttribute('aria-label', 'Фільтр за роллю');
  const roleButtons = ROLE_FILTERS.map(({ value, label }) => {
    const button = toolButton(ROLE_ICONS[value], label, 'admin__tool--outline');
    button.dataset.role = value;
    button.addEventListener('click', () => update({ role: state.role === value ? '' : value }));
    return button;
  });
  roles.append(...roleButtons);

  // Календар дати реєстрації
  const dateWrap = el('div', 'admin__date');
  const dateButton = toolButton('calendar', 'Фільтр за датою реєстрації');
  dateButton.setAttribute('aria-haspopup', 'dialog');
  dateButton.setAttribute('aria-expanded', 'false');
  const datePopup = el('div', 'admin__popup');
  datePopup.hidden = true;
  datePopup.setAttribute('role', 'dialog');
  datePopup.setAttribute('aria-label', 'Дата реєстрації');
  const calendar = Calendar({
    range: { from: state.from, to: state.to },
    onChange: ({ from, to }) => update({ from, to }),
  });
  const clearDate = Button({ text: 'Скинути дату', variant: 'secondary', size: 'xxs' });
  clearDate.addEventListener('click', () => {
    calendar.setRange({});
    update({ from: '', to: '' });
  });
  datePopup.append(calendar, clearDate);
  dateWrap.append(dateButton, datePopup);

  function toggleDate(open = datePopup.hidden) {
    datePopup.hidden = !open;
    dateButton.setAttribute('aria-expanded', String(open));
    if (open) document.addEventListener('click', onOutsideDate, true);
    else document.removeEventListener('click', onOutsideDate, true);
  }
  function onOutsideDate(event) {
    if (!dateWrap.contains(event.target)) toggleDate(false);
  }
  dateButton.addEventListener('click', () => toggleDate());
  datePopup.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      toggleDate(false);
      dateButton.focus();
    }
  });
  cleanups.push(() => document.removeEventListener('click', onOutsideDate, true));

  // Сортування
  const sortButton = toolButton('sort', 'Сортування');
  const sort = Dropdown({
    trigger: sortButton,
    label: 'Сортування',
    options: SORTS.map(({ value, label }) => ({ value, label })),
    value: state.sort,
    onChange: (value) => update({ sort: value }),
  });
  sort.classList.add('admin__sort');
  cleanups.push(() => sort.destroy());

  const tools = el('div', 'admin__tools');
  const right = el('div', 'admin__tools-right');
  right.append(dateWrap, sort);
  tools.append(roles, right);

  // Активні фільтри, щоб було видно, чому список короткий
  const chips = el('div', 'admin__chips');

  const status = el('p', 'visually-hidden');
  status.setAttribute('role', 'status');

  const head = el('div', 'admin__columns');
  head.setAttribute('aria-hidden', 'true');
  for (const text of ['Користувач', 'Email', 'Роль', 'Дата реєстрації', 'Статус', '']) {
    head.append(el('span', '', text));
  }

  const list = el('ul', 'admin__list');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'Користувачі');

  const footer = el('div', 'admin__footer');
  const dialog = ConfirmDialog();

  root.append(back, title, search, tools, chips, status, head, list, footer, dialog);

  function syncControls() {
    for (const button of roleButtons) {
      const active = button.dataset.role === state.role;
      button.classList.toggle('admin__tool--active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    const dateLabel = dateRangeLabel(state);
    dateButton.classList.toggle('admin__tool--active', Boolean(dateLabel));
    dateButton.setAttribute(
      'aria-label',
      dateLabel ? `Дата реєстрації: ${dateLabel}` : 'Фільтр за датою реєстрації',
    );

    chips.replaceChildren();
    const chip = (text, reset) => {
      const button = el('button', 'admin__chip');
      button.type = 'button';
      button.setAttribute('aria-label', `${text}: прибрати фільтр`);
      button.append(el('span', '', text), Icon('close', { size: '0.625rem' }));
      button.addEventListener('click', reset);
      chips.append(button);
    };
    if (state.role) {
      const label = ROLE_FILTERS.find((r) => r.value === state.role).label;
      chip(label, () => update({ role: '' }));
    }
    if (dateLabel) {
      chip(`Реєстрація: ${dateLabel}`, () => {
        calendar.setRange({});
        update({ from: '', to: '' });
      });
    }
    chips.hidden = !chips.childElementCount;
  }

  // Зміна фільтрів скидає сторінку на першу. Адресу оновлюємо без перебудови сторінки,
  // щоб поле пошуку не втрачало фокус
  function update(patch) {
    const next = { ...state, ...patch };
    if (!('page' in patch)) next.page = 1;
    state = next;
    window.history.replaceState(window.history.state, '', withBase(adminHref(state)));
    syncControls();
    load();
  }

  function renderRows() {
    for (const node of list.children) node.destroy?.();
    const viewer = store.get().user;
    list.replaceChildren(...items.map((user) => UserRow(user, { viewer, onAction })));
  }

  function Pagination(pages) {
    const nav = el('nav', 'home__pagination admin__pagination');
    nav.setAttribute('aria-label', 'Сторінки користувачів');
    const prev = Button({
      text: 'Назад',
      variant: 'secondary',
      arrowLeft: true,
      disabled: state.page <= 1,
      onClick: () => goTo(state.page - 1),
    });
    const next = Button({
      text: 'Далі',
      arrowRight: true,
      disabled: state.page >= pages,
      onClick: () => goTo(state.page + 1),
    });
    nav.append(prev, next);
    return nav;
  }

  function goTo(page) {
    update({ page });
    title.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function Message(heading, text, action) {
    const box = el('div', 'home__message');
    box.append(el('p', 'home__message-title', heading), el('p', 'home__message-text', text));
    if (action) box.append(action);
    return box;
  }

  function resetFilters() {
    search.input.value = '';
    calendar.setRange({});
    update({ q: '', role: '', from: '', to: '' });
  }

  async function load() {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;

    list.setAttribute('aria-busy', 'true');
    list.replaceChildren(...Array.from({ length: 4 }, Skeleton));
    footer.replaceChildren();
    status.textContent = 'Завантаження користувачів…';

    try {
      const data = await adminApi.users(adminApiQuery(state), { signal });
      if (signal.aborted) return;
      // Сторінки після останньої немає (наприклад, після зміни фільтра в іншій вкладці)
      if (data.pages > 0 && state.page > data.pages) {
        update({ page: data.pages });
        return;
      }
      items = data.items;
      list.removeAttribute('aria-busy');
      status.textContent = `Знайдено користувачів: ${data.total}`;

      if (items.length === 0) {
        list.replaceChildren();
        footer.replaceChildren(
          hasFilters(state)
            ? Message(
                'Нікого не знайдено',
                'Спробуйте змінити пошук чи фільтри',
                Button({ text: 'Скинути фільтри', size: 'xs', onClick: resetFilters }),
              )
            : Message('Користувачів поки немає', ''),
        );
        return;
      }
      renderRows();
      if (data.pages > 1) footer.replaceChildren(Pagination(data.pages));
    } catch (error) {
      if (error.name === 'AbortError') return;
      list.removeAttribute('aria-busy');
      list.replaceChildren();
      status.textContent = '';
      footer.replaceChildren(
        Message(
          'Не вдалося завантажити користувачів',
          error.message || 'Спробуйте пізніше',
          Button({ text: 'Спробувати ще', size: 'xs', onClick: load }),
        ),
      );
    }
  }

  // Бан і розбан після підтвердження. Список оновлюється на місці, без перезавантаження
  function onAction(user, action) {
    dialog.ask(user, action, async () => {
      try {
        const updated = await adminApi.setStatus(user.id, action === 'unban');
        items = replaceUser(items, updated);
        const index = items.findIndex((item) => item.id === updated.id);
        const old = list.querySelector(`[data-user-id="${updated.id}"]`);
        old?.destroy?.();
        const row = UserRow(items[index], { viewer: store.get().user, onAction });
        old?.replaceWith(row);
        pushToast(confirmText(user, action).done, 'success');
        row.querySelector('.user-row__name')?.focus();
        return true;
      } catch (error) {
        pushToast(error.message || 'Не вдалося змінити статус', 'error');
        return true;
      }
    });
  }

  syncControls();
  load();

  return {
    el: root,
    destroy() {
      controller?.abort();
      clearTimeout(searchTimer);
      for (const node of list.children) node.destroy?.();
      cleanups.forEach((fn) => fn());
    },
  };
}
