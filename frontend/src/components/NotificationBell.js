import '../styles/components/notifications.css';
import { notificationsApi } from '../api/notifications.js';
import { achievementTitle } from '../achievements.js';
import { withBase } from '../router/base.js';
import { MAX_RATING } from './Rating.js';
import avatarPlaceholder from '../assets/images/avatar-placeholder.svg';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const POLL_INTERVAL = 60000;
export const PAGE_SIZE = 10;
// Подія, після якої лічильник оновлюється одразу, а не за хвилину (наприклад, нове досягнення)
export const REFRESH_EVENT = 'notifications:refresh';

// ====== Чисті функції (покриті тестами) ======

export function badgeText(count) {
  if (!count || count < 1) return '';
  return count > 99 ? '99+' : String(count);
}

function personName(actor) {
  return actor?.name || actor?.username || 'Користувач';
}

// Заголовок і підпис сповіщення. Імена не відмінюємо (їх не можна правильно провідмінювати
// автоматично), тому ім'я завжди окремо в підписі
export function notificationText(notification) {
  const { type, data = {}, actor } = notification;
  switch (type) {
    case 'COMMENT':
      return {
        title: 'Новий коментар до вашої світлини',
        text: data.text ? `${personName(actor)}: «${data.text}»` : personName(actor),
      };
    case 'RATING':
      return {
        title: `Оцінка ${data.value} з ${MAX_RATING} вашій світлині`,
        text: personName(actor),
      };
    case 'ACHIEVEMENT':
      return {
        title: `Нове досягнення: «${achievementTitle(data.code)}»`,
        text: 'Значок уже у вашому профілі',
      };
    case 'MODERATOR':
      return { title: 'Вас призначено модератором', text: `Адміністратор: ${personName(actor)}` };
    default:
      return { title: 'Нове сповіщення', text: '' };
  }
}

// Куди веде сповіщення: до світлини, у профіль (досягнення) або в адмінку (модератор)
export function notificationHref(notification, user) {
  if (notification.photo) return `/photos/${notification.photo.slug ?? notification.photo.id}`;
  if (notification.type === 'ACHIEVEMENT' && user) {
    return `/users/${encodeURIComponent(user.username)}`;
  }
  if (notification.type === 'MODERATOR') return '/admin';
  return null;
}

export function timeAgo(value, now = Date.now()) {
  const diff = Math.max(0, now - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'щойно';
  if (minutes < 60) return `${minutes} хв тому`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} год тому`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн тому`;
  return new Date(value).toLocaleDateString('uk-UA');
}

// ====== Компонент ======

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function bellIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML =
    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>';
  return svg;
}

function Item(notification, { user, onOpen }) {
  const { title, text } = notificationText(notification);
  const href = notificationHref(notification, user);
  const item = el('li', 'notice');
  if (!notification.read) item.classList.add('notice--unread');
  item.dataset.id = notification.id;

  const body = el(href ? 'a' : 'div', 'notice__body');
  if (href) body.href = withBase(href);

  const visual = notification.actor
    ? Object.assign(el('img', 'notice__avatar'), {
        src: notification.actor.avatarUrl || avatarPlaceholder,
        alt: '',
        width: 36,
        height: 36,
        loading: 'lazy',
      })
    : el('span', 'notice__system', notification.type === 'ACHIEVEMENT' ? '★' : '!');

  const content = el('span', 'notice__content');
  content.append(el('span', 'notice__title', title));
  if (text) content.append(el('span', 'notice__text', text));
  const time = el('time', 'notice__time', timeAgo(notification.createdAt));
  time.dateTime = notification.createdAt;
  content.append(time);
  if (!notification.read) content.append(el('span', 'visually-hidden', 'Непрочитане'));

  body.append(visual, content);
  body.addEventListener('click', (event) => onOpen(notification, event));
  item.append(body);
  return item;
}

// Дзвіночок у шапці: лічильник непрочитаних і панель зі списком.
// Лічильник оновлюється раз на хвилину і коли вкладка знову стає активною
export function NotificationBell({ store, navigate, api = notificationsApi } = {}) {
  const root = el('div', 'bell');
  const button = el('button', 'bell__button');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'notifications-panel');
  const badge = el('span', 'bell__badge');
  badge.setAttribute('aria-hidden', 'true');
  badge.hidden = true;
  button.append(bellIcon(), badge);

  const panel = el('div', 'bell__panel');
  panel.id = 'notifications-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Сповіщення');
  panel.hidden = true;

  const head = el('div', 'bell__head');
  const heading = el('p', 'bell__title', 'Сповіщення');
  const readAll = el('button', 'bell__read-all', 'Позначити всі прочитаними');
  readAll.type = 'button';
  head.append(heading, readAll);
  const status = el('p', 'bell__status');
  status.setAttribute('role', 'status');
  const list = el('ul', 'bell__list');
  list.setAttribute('role', 'list');
  const more = el('button', 'bell__more', 'Показати ще');
  more.type = 'button';
  more.hidden = true;
  panel.append(head, status, list, more);
  root.append(button, panel);

  let count = 0;
  let items = [];
  let total = 0;
  let page = 0;
  let timer = null;
  let destroyed = false;

  function setCount(next) {
    count = Math.max(0, next);
    badge.textContent = badgeText(count);
    badge.hidden = !count;
    readAll.disabled = !count;
    button.setAttribute(
      'aria-label',
      count ? `Сповіщення, непрочитаних: ${count}` : 'Сповіщення, нових немає',
    );
  }

  async function refreshCount() {
    if (destroyed || !store.get().user) return;
    try {
      setCount(await api.unreadCount());
    } catch {
      // Лічильник другорядний: помилку не показуємо, спробуємо при наступному оновленні
    }
  }

  function renderList() {
    const user = store.get().user;
    list.replaceChildren(...items.map((n) => Item(n, { user, onOpen })));
    more.hidden = items.length >= total;
    status.textContent = items.length ? '' : 'Сповіщень поки немає';
  }

  async function loadPage(reset = false) {
    if (reset) {
      items = [];
      page = 0;
      status.textContent = 'Завантаження…';
    }
    more.disabled = true;
    try {
      const data = await api.list({ page: page + 1, limit: PAGE_SIZE });
      page += 1;
      total = data.total;
      const seen = new Set(items.map((n) => n.id));
      items = [...items, ...data.items.filter((n) => !seen.has(n.id))];
      renderList();
    } catch (error) {
      status.textContent = error.message || 'Не вдалося завантажити сповіщення';
    } finally {
      more.disabled = false;
    }
  }

  async function markRead(ids) {
    try {
      const { unread } = await api.markRead(ids);
      const target = ids ? new Set(ids) : null;
      items = items.map((n) => (!target || target.has(n.id) ? { ...n, read: true } : n));
      setCount(unread);
      renderList();
    } catch {
      // Не вдалося позначити - лишаємо як є, наступне оновлення покаже правильний стан
    }
  }

  function onOpen(notification, event) {
    if (!notification.read) markRead([notification.id]);
    const href = notificationHref(notification, store.get().user);
    if (href && navigate && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      close();
      navigate(href);
    }
  }

  function onOutside(event) {
    if (!root.contains(event.target)) close();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      close();
      button.focus();
    }
  }

  function open() {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutside, true);
    document.addEventListener('keydown', onKeydown);
    loadPage(true);
  }

  function close() {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutside, true);
    document.removeEventListener('keydown', onKeydown);
  }

  function onVisible() {
    if (document.visibilityState === 'visible') refreshCount();
  }

  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  readAll.addEventListener('click', () => markRead());
  more.addEventListener('click', () => loadPage());
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener(REFRESH_EVENT, refreshCount);

  setCount(0);
  refreshCount();
  timer = setInterval(refreshCount, POLL_INTERVAL);

  return Object.assign(root, {
    refresh: refreshCount,
    destroy() {
      destroyed = true;
      clearInterval(timer);
      close();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(REFRESH_EVENT, refreshCount);
    },
  });
}
