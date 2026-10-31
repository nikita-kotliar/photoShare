import spriteMarkup from '../assets/icons/sprite.svg?raw';

const ICON_PREFIX = 'icon-';
const SVG_NS = 'http://www.w3.org/2000/svg';

export const iconAliases = {
  send: 'Send',
  backDesktop: 'arrowDeskTop',
  backTablet: 'arrowTablet-1',
  backMobile: 'arrowMobile-1',
  selectArrow: 'lsicon_arrow-down-outline-1',
  facebook: 'Vector-14',
  instagram: 'Vector-13',
  twitter: 'Vector-12',
  linkedin: 'Vector-4',
  eyeOff: 'Vector-11',
  expand: 'uiw_arrows-alt',
  qr: 'bi_qr-code',
  star: 'Vector-10',
  search: 'Vector-9',
  user: 'Vector-8',
  role: 'Role',
  shieldPlus: 'Vector-7',
  pencil: 'material-symbols_edit-outline',
  award: 'material-symbols_award-star-outline',
  block: 'octicon_blocked-16',
  ban: 'Vector-6',
  trash: 'Vector-5',
  calendar: 'Group-2',
  lock: 'material-symbols_edit-outline-1',
  starFilled: 'star-filled',
  burger: 'burger',
  close: 'close',
  exit: 'exit',
  chevrons: 'chevrons',
  sort: 'sort',
  filter: 'filter',
  checkbox: 'checkbox',
  arrowRight: 'arrow-right',
  arrowLeft: 'arrow-left',
  eye: 'eye',
};

export function mountSprite() {
  if (document.getElementById('svg-sprite')) return;
  const holder = document.createElement('div');
  holder.id = 'svg-sprite';
  holder.hidden = true;
  holder.innerHTML = spriteMarkup;
  document.body.prepend(holder);
}

export function listIcons() {
  return [...document.querySelectorAll('#svg-sprite symbol')].map((symbol) =>
    symbol.id.replace(ICON_PREFIX, ''),
  );
}

export function Icon(name, { size, label, color, color2 } = {}) {
  const id = iconAliases[name] || name;
  const symbol = document.getElementById(`${ICON_PREFIX}${id}`);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('focusable', 'false');

  const viewBox = symbol?.getAttribute('viewBox');
  if (viewBox) {
    const [, , width, height] = viewBox.split(/\s+/).map(Number);
    svg.setAttribute('viewBox', viewBox);
    svg.style.setProperty('--icon-ratio', String(width / height));
  }

  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }

  if (size) svg.style.setProperty('--icon-size', typeof size === 'number' ? `${size}px` : size);
  if (color) svg.style.color = color;
  if (color) svg.style.setProperty('--color1', color);
  if (color2) svg.style.setProperty('--color2', color2);

  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${ICON_PREFIX}${id}`);
  svg.append(use);
  return svg;
}
