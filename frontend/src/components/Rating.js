import '../styles/components/rating.css';
import { ratingsApi } from '../api/ratings.js';
import { pushToast } from '../store/index.js';
import { Icon } from './icons.js';

export const MAX_RATING = 5;

export function pluralRatings(count) {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return 'оцінок';
  if (last === 1) return 'оцінка';
  if (last >= 2 && last <= 4) return 'оцінки';
  return 'оцінок';
}

export function ratingText(photo) {
  const count = photo.ratingsCount ?? 0;
  return `${photo.averageRating ?? '-'} (${count} ${pluralRatings(count)})`;
}

export function ratingMode(user, photo) {
  if (!user) return 'guest';
  if (photo.author?.id === user.id) return 'owner';
  if (photo.myRating || photo.rated) return 'rated';
  return 'rate';
}

export function ratingHint(mode, photo) {
  if (mode === 'guest') return 'Увійдіть, щоб оцінити світлину';
  if (mode === 'owner') return 'Свою світлину оцінити не можна';
  if (mode === 'rated') {
    return photo.myRating
      ? `Ваша оцінка: ${photo.myRating} з ${MAX_RATING}`
      : 'Ви вже оцінили цю світлину';
  }
  return 'Оцініть світлину';
}

export function ratingError(error) {
  if (error?.status === 409) return 'Ви вже оцінили цю світлину';
  if (error?.status === 403) return error.message || 'Цю світлину оцінити не можна';
  return error?.message || 'Не вдалося зберегти оцінку';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function Star(fill, size) {
  const star = el('span', 'rating__star');
  star.style.setProperty('--fill', `${fill * 100}%`);
  const filled = el('span', 'rating__star-fill');
  filled.append(Icon('starFilled', { size }));
  star.append(Icon('starFilled', { size }), filled);
  return star;
}

function fillFor(value, index) {
  return Math.min(Math.max((value ?? 0) - index, 0), 1);
}

// Рейтинг
export function Rating(
  photo,
  { user, size = '1.375rem', textClass = '', rate = ratingsApi.rate, onRated } = {},
) {
  let current = { ...photo };
  const root = el('span', 'rating');

  function render() {
    const mode = ratingMode(user, current);
    const hint = ratingHint(mode, current);
    const text = el('span', `rating__text ${textClass}`.trim(), ratingText(current));
    root.className = `rating rating--${mode}`;

    if (mode !== 'rate') {
      const stars = el('span', 'rating__stars');
      stars.setAttribute('role', 'img');
      stars.setAttribute('aria-label', `Рейтинг ${current.averageRating ?? 'відсутній'}. ${hint}`);
      stars.title = hint;
      for (let i = 0; i < MAX_RATING; i += 1) {
        stars.append(Star(fillFor(current.averageRating, i), size));
      }
      root.replaceChildren(stars, text);
      return;
    }

    const group = el('span', 'rating__stars rating__stars--input');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', hint);
    const buttons = [];
    for (let i = 0; i < MAX_RATING; i += 1) {
      const value = i + 1;
      const button = el('button', 'rating__button');
      button.type = 'button';
      button.setAttribute('aria-label', `Оцінити на ${value} з ${MAX_RATING}`);
      button.append(Star(fillFor(current.averageRating, i), size));
      button.addEventListener('mouseenter', () => preview(value));
      button.addEventListener('focus', () => preview(value));
      button.addEventListener('click', () => submit(value));
      buttons.push(button);
      group.append(button);
    }
    group.addEventListener('mouseleave', () => preview(0));
    group.addEventListener('focusout', (event) => {
      if (!group.contains(event.relatedTarget)) preview(0);
    });

    function preview(value) {
      buttons.forEach((button, i) => button.classList.toggle('rating__button--on', i < value));
      group.classList.toggle('rating__stars--preview', value > 0);
    }

    async function submit(value) {
      buttons.forEach((button) => (button.disabled = true));
      group.setAttribute('aria-busy', 'true');
      try {
        const result = await rate(current.id, value);
        current = {
          ...current,
          averageRating: result.averageRating,
          ratingsCount: result.ratingsCount,
          myRating: value,
        };
        pushToast('Дякуємо за оцінку', 'success');
        onRated?.(current);
        render();
      } catch (error) {
        pushToast(ratingError(error), 'error');
        if (error?.status === 409) {
          current = { ...current, rated: true };
          render();
          return;
        }
        buttons.forEach((button) => (button.disabled = false));
        group.removeAttribute('aria-busy');
      }
    }

    root.replaceChildren(group, text);
  }

  render();
  return root;
}
