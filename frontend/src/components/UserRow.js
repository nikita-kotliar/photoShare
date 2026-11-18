import { Dropdown } from './Dropdown.js';
import { Icon } from './icons.js';
import { withBase } from '../router/base.js';
import avatarPlaceholder from '../assets/images/avatar-placeholder.svg';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const ROLE_LABELS = {
  USER: 'Користувач',
  MODERATOR: 'Модератор',
  ADMIN: 'Адміністратор',
};

export const ROLE_ICONS = { USER: 'award', MODERATOR: 'shieldPlus', ADMIN: 'user' };

export const BANNED_TEXT = 'Користувач заблокований';

export function formatUserDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const day = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Банити може лише ADMIN, і не себе та не іншого ADMIN (як перевіряє API)
export function canChangeStatus(viewer, user) {
  return Boolean(
    viewer && user && viewer.role === 'ADMIN' && viewer.id !== user.id && user.role !== 'ADMIN',
  );
}

export function statusAction(user) {
  return user.isActive
    ? { value: 'ban', label: 'Забанити користувача', short: 'Забанити', icon: 'ban' }
    : {
        value: 'unban',
        label: 'Розблокувати користувача',
        short: 'Розблокувати',
        icon: 'checkbox',
      };
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
    '<circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/>';
  return svg;
}

function RoleBadge(role) {
  const badge = el('span', 'user-row__role');
  badge.append(Icon(ROLE_ICONS[role] ?? 'award', { size: '1rem', label: ROLE_LABELS[role] }));
  badge.append(el('span', 'user-row__role-text', ROLE_LABELS[role] ?? role));
  return badge;
}

// Рядок користувача: на мобілці й планшеті картка з меню ⋮, на десктопі рядок таблиці
// з кнопкою дії. onAction(user, 'ban' | 'unban') викликається з будь-якого з двох варіантів
export function UserRow(user, { viewer, onAction } = {}) {
  const item = el('li', 'user-row');
  item.dataset.userId = String(user.id);
  if (!user.isActive) item.classList.add('user-row--banned');

  const avatar = el('img', 'user-row__avatar');
  avatar.src = user.avatarUrl || avatarPlaceholder;
  avatar.alt = '';
  avatar.width = 64;
  avatar.height = 64;
  avatar.loading = 'lazy';

  const main = el('div', 'user-row__main');
  const head = el('p', 'user-row__head');
  const name = el('a', 'user-row__name', user.name || user.username);
  name.href = withBase(`/users/${encodeURIComponent(user.username)}`);
  head.append(name);
  if (user.isActive) {
    head.append(RoleBadge(user.role));
  } else {
    head.append(Icon('block', { size: '1rem', label: 'Заблокований' }));
  }
  main.append(head);

  const email = el('p', 'user-row__email', user.email);
  const date = el('time', 'user-row__date', formatUserDate(user.createdAt));
  date.dateTime = user.createdAt ?? '';
  const status = el('p', 'user-row__status', user.isActive ? 'Активний' : BANNED_TEXT);
  if (user.isActive) {
    main.append(email, date);
  } else {
    main.append(status);
  }

  // Колонки десктопного рядка: email і дата лишаються видимими і для забанених
  const columns = el('div', 'user-row__columns');
  const columnEmail = el('span', 'user-row__col user-row__col--email', user.email);
  const columnDate = el(
    'time',
    'user-row__col user-row__col--date',
    formatUserDate(user.createdAt),
  );
  columnDate.dateTime = user.createdAt ?? '';
  const columnRole = el('span', 'user-row__col user-row__col--role');
  columnRole.append(RoleBadge(user.role));
  const columnStatus = el(
    'span',
    'user-row__col user-row__col--status',
    user.isActive ? 'Активний' : 'Заблокований',
  );
  columns.append(columnEmail, columnRole, columnDate, columnStatus);

  item.append(avatar, main, columns);

  const actions = el('div', 'user-row__actions');
  if (canChangeStatus(viewer, user)) {
    const action = statusAction(user);
    const who = user.name || user.username;

    const trigger = el('button', 'user-row__more');
    trigger.type = 'button';
    trigger.setAttribute('aria-label', `Дії з користувачем ${who}`);
    trigger.append(dotsIcon());
    const menu = Dropdown({
      trigger,
      label: `Дії з користувачем ${who}`,
      selectable: false,
      options: [{ value: action.value, label: action.label, icon: action.icon }],
      onChange: (value) => onAction?.(user, value),
    });
    menu.classList.add('user-row__menu');

    const button = el('button', `user-row__action user-row__action--${action.value}`);
    button.type = 'button';
    button.setAttribute('aria-label', `${action.label}: ${who}`);
    button.append(Icon(action.icon, { size: '1rem' }), el('span', '', action.short));
    button.addEventListener('click', () => onAction?.(user, action.value));

    actions.append(menu, button);
    item.destroy = () => menu.destroy();
  }
  item.append(actions);

  return item;
}
