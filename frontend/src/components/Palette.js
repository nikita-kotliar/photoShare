import '../styles/components/palette.css';
import { withBase } from '../router/base.js';

export const COLOR_NAMES = {
  red: 'червоний',
  orange: 'помаранчевий',
  yellow: 'жовтий',
  green: 'зелений',
  teal: 'бірюзовий',
  blue: 'синій',
  purple: 'фіолетовий',
  pink: 'рожевий',
  brown: 'коричневий',
  black: 'чорний',
  gray: 'сірий',
  white: 'білий',
};

export function colorName(family) {
  return COLOR_NAMES[family] ?? family;
}

export function Palette(colors = []) {
  const list = document.createElement('ul');
  list.className = 'palette';
  list.setAttribute('aria-label', 'Кольори світлини');
  if (!colors.length) {
    list.hidden = true;
    return list;
  }
  for (const { hex, family } of colors) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'palette__swatch';
    link.href = withBase(`/search?color=${encodeURIComponent(family)}`);
    link.style.setProperty('--swatch', hex);
    link.title = `${colorName(family)} (${hex})`;
    link.setAttribute('aria-label', `Знайти світлини, де є ${colorName(family)} колір`);
    item.append(link);
    list.append(item);
  }
  return list;
}
