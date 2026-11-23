import '../styles/components/achievements.css';
import { achievementsApi } from '../api/achievements.js';
import { ACHIEVEMENTS } from '../achievements.js';
import { achievementIcon } from './AchievementToast.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function formatEarned(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `Отримано ${date.toLocaleDateString('uk-UA')}`;
}

// Каталог фронтенду + відповідь API: назва, підказка, чи отримано. Порядок - як у каталозі
export function badgeList(items = []) {
  const byCode = new Map(items.map((item) => [item.code, item]));
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    earned: Boolean(byCode.get(a.code)?.earned),
    earnedAt: byCode.get(a.code)?.earnedAt ?? null,
  }));
}

function Badge(badge) {
  const item = el('li');
  const card = el('div', `badge${badge.earned ? '' : ' badge--locked'}`);
  card.title = badge.earned ? badge.title : `Як отримати: ${badge.hint}`;
  const icon = el('span', 'badge__icon', achievementIcon(badge.code));
  icon.setAttribute('aria-hidden', 'true');
  const status = badge.earned ? formatEarned(badge.earnedAt) : badge.hint;
  card.append(
    icon,
    el('span', 'badge__name', badge.title),
    el('span', 'badge__meta', status),
    el('span', 'visually-hidden', badge.earned ? 'Отримано.' : 'Ще не отримано.'),
  );
  item.append(card);
  return item;
}

// Блок «Досягнення» в профілі: отримані кольорові з датою, неотримані сірі з підказкою
export function AchievementsBlock(username, { api = achievementsApi, signal } = {}) {
  const section = el('section', 'achievements');
  section.setAttribute('aria-labelledby', 'achievements-title');
  const title = el('h2', 'achievements__title', 'Досягнення ');
  title.id = 'achievements-title';
  const count = el('span', 'achievements__count');
  title.append(count);
  const list = el('ul', 'achievements__list');
  list.setAttribute('role', 'list');
  section.append(title, list);

  function render(items) {
    const badges = badgeList(items);
    const earned = badges.filter((b) => b.earned).length;
    count.textContent = `${earned} з ${badges.length}`;
    list.replaceChildren(...badges.map(Badge));
  }

  render([]);
  api
    .list(username, { signal })
    .then(render)
    .catch((error) => {
      if (error.name === 'AbortError') return;
      // Без даних показуємо всі значки як неотримані: блок другорядний для профілю
      count.textContent = '';
    });
  return section;
}
