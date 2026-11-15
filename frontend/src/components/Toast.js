import '../styles/components/toast.css';
import { dismissToast } from '../store/index.js';
import { Icon } from './icons.js';

export const TOAST_TIMEOUT = { info: 4000, success: 4000, error: 7000 };
export const MAX_TOASTS = 3;

export function toastDuration(type) {
  return TOAST_TIMEOUT[type] ?? TOAST_TIMEOUT.info;
}

export function visibleToasts(toasts, max = MAX_TOASTS) {
  return toasts.slice(-max);
}

function Toast(toast, onClose) {
  const item = el('div', `toast toast--${toast.type}`);
  item.setAttribute('role', toast.type === 'error' ? 'alert' : 'status');
  item.append(el('p', 'toast__text', toast.message));

  const close = el('button', 'toast__close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрити повідомлення');
  close.append(Icon('close', { size: '0.75rem' }));
  close.addEventListener('click', onClose);
  item.append(close);

  let left = toastDuration(toast.type);
  let started = Date.now();
  let timer = setTimeout(onClose, left);
  const pause = () => {
    clearTimeout(timer);
    left -= Date.now() - started;
  };
  const resume = () => {
    started = Date.now();
    timer = setTimeout(onClose, Math.max(left, 1000));
  };
  item.addEventListener('mouseenter', pause);
  item.addEventListener('mouseleave', resume);
  item.addEventListener('focusin', pause);
  item.addEventListener('focusout', resume);

  return Object.assign(item, { stop: () => clearTimeout(timer) });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Повідомлення
export function Toasts({ store, dismiss = dismissToast }) {
  const region = el('div', 'toasts');
  region.setAttribute('aria-live', 'polite');
  const shown = new Map();

  function render(toasts) {
    const list = visibleToasts(toasts);
    const ids = new Set(list.map((toast) => toast.id));
    for (const [id, node] of shown) {
      if (ids.has(id)) continue;
      node.stop();
      node.remove();
      shown.delete(id);
    }
    for (const toast of list) {
      if (shown.has(toast.id)) continue;
      const node = Toast(toast, () => dismiss(toast.id));
      shown.set(toast.id, node);
      region.append(node);
    }
  }

  store.subscribe(render, (s) => s.toasts);
  render(store.get().toasts);
  return region;
}

// Індикатор запитів
export function LoadingBar({ store, delay = 300 }) {
  const bar = el('div', 'loading-bar');
  bar.setAttribute('aria-hidden', 'true');
  let timer = null;

  function update(pending) {
    clearTimeout(timer);
    if (pending > 0) {
      timer = setTimeout(() => bar.classList.add('loading-bar--active'), delay);
    } else {
      bar.classList.remove('loading-bar--active');
    }
  }

  store.subscribe(update, (s) => s.pending);
  return bar;
}
