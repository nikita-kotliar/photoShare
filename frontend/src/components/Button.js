import { Icon } from './icons.js';

const SIZES = ['xxxs', 'xxs', 'xs', 's', 'm', 'l', 'xl'];
const VARIANTS = ['primary', 'secondary', 'danger'];

function arrow(direction) {
  const icon = Icon('backDesktop', { size: 16 });
  if (direction === 'right') icon.classList.add('icon--flip');
  return icon;
}

export function Button({
  text = '',
  variant = 'primary',
  size,
  type = 'button',
  href,
  arrowLeft = false,
  arrowRight = false,
  disabled = false,
  className = '',
  onClick,
} = {}) {
  const el = document.createElement(href ? 'a' : 'button');
  const classes = ['btn', `btn--${VARIANTS.includes(variant) ? variant : 'primary'}`];
  if (SIZES.includes(size)) classes.push(`btn--${size}`);
  if (className) classes.push(className);
  el.className = classes.join(' ');

  if (href) {
    el.href = href;
    if (disabled) el.setAttribute('aria-disabled', 'true');
  } else {
    el.type = type;
    el.disabled = disabled;
  }

  if (arrowLeft) el.append(arrow('left'));
  if (text) {
    const label = document.createElement('span');
    label.className = 'btn__text';
    label.textContent = text;
    el.append(label);
  }
  if (arrowRight) el.append(arrow('right'));

  if (onClick) el.addEventListener('click', onClick);
  return el;
}

// Кнопка-іконка
export function IconButton({ icon, label, type = 'button', disabled = false, onClick } = {}) {
  const el = document.createElement('button');
  el.className = 'icon-btn';
  el.type = type;
  el.disabled = disabled;
  el.setAttribute('aria-label', label);
  el.append(Icon(icon, { size: 24 }));
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

// Стан завантаження
export function setButtonLoading(button, loading, loadingText = 'Зачекайте...') {
  const label = button.querySelector('.btn__text');
  if (loading) {
    button.dataset.text = label?.textContent ?? '';
    if (label) label.textContent = loadingText;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    if (label && button.dataset.text !== undefined) label.textContent = button.dataset.text;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}
