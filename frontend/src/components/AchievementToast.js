import '../styles/components/achievements.css';
import { ACHIEVEMENTS, achievementTitle } from '../achievements.js';
import { confetti } from './motion.js';

export const TOAST_DURATION = 5000;

// Значок досягнення: емодзі в колі. Однаковий у тості і в профілі
export const ACHIEVEMENT_ICONS = {
  FIRST_PHOTO: '📷',
  TEN_PHOTOS: '🏅',
  COMMENTATOR: '💬',
  CRITIC: '⭐',
  FAVORITE: '❤️',
};

export function achievementIcon(code) {
  return ACHIEVEMENT_ICONS[code] ?? '🏆';
}

// Коди невідомі фронтенду пропускаємо, порядок - як у каталозі
export function knownAchievements(codes = []) {
  const known = new Set(ACHIEVEMENTS.map((a) => a.code));
  return [...new Set(codes)].filter((code) => known.has(code));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let region = null;
let queue = [];
let showing = false;

function ensureRegion() {
  if (region?.isConnected) return region;
  region = el('div', 'achievement-toasts');
  region.setAttribute('aria-live', 'polite');
  document.body.append(region);
  return region;
}

function showNext() {
  const code = queue.shift();
  if (!code) {
    showing = false;
    return;
  }
  showing = true;
  const toast = el('div', 'achievement-toast');
  toast.setAttribute('role', 'status');
  const badge = el('span', 'achievement-toast__badge', achievementIcon(code));
  badge.setAttribute('aria-hidden', 'true');
  const text = el('div', 'achievement-toast__text');
  text.append(
    el('p', 'achievement-toast__label', 'Нове досягнення!'),
    el('p', 'achievement-toast__title', achievementTitle(code)),
  );
  const close = el('button', 'achievement-toast__close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрити');
  toast.append(badge, text, close);
  ensureRegion().append(toast);
  confetti({ count: 40 });

  let done = false;
  const hide = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    toast.classList.add('achievement-toast--leaving');
    // Без анімації (prefers-reduced-motion) animationend не прийде
    setTimeout(() => {
      toast.remove();
      showNext();
    }, 400);
  };
  const timer = setTimeout(hide, TOAST_DURATION);
  close.addEventListener('click', hide);
}

// Показує тост для кожного нового досягнення по черзі
export function showAchievements(codes) {
  queue.push(...knownAchievements(codes));
  if (!showing) showNext();
}
