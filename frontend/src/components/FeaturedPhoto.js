import '../styles/components/featured.css';
import { photosApi } from '../api/photos.js';
import { withBase } from '../router/base.js';
import { Icon } from './icons.js';
import { ratingText } from './Rating.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function featuredMeta(photo) {
  const author = photo.author?.name || photo.author?.username || '';
  return author ? `${author} · ${ratingText(photo)}` : ratingText(photo);
}

export function FeaturedCard(photo) {
  const title = photo.description || 'Без назви';
  const card = el('a', 'featured');
  card.href = withBase(`/photos/${photo.slug ?? photo.id}`);

  const media = el('span', 'featured__media');
  const img = el('img', 'featured__img');
  img.src = photo.url;
  img.alt = '';
  img.width = 320;
  img.height = 320;
  img.loading = 'lazy';
  img.decoding = 'async';
  media.append(img);

  const body = el('span', 'featured__body');
  const badge = el('span', 'featured__badge');
  badge.append(Icon('star', { size: '0.875rem' }), el('span', '', 'Світлина тижня'));
  body.append(
    badge,
    el('span', 'featured__title', title),
    el('span', 'featured__meta', featuredMeta(photo)),
  );

  card.append(media, body);
  return card;
}

export function FeaturedPhoto({ signal } = {}) {
  const slot = el('div', 'featured-slot featured-slot--loading');
  slot.setAttribute('aria-hidden', 'true');
  photosApi
    .featured({ signal })
    .then((photo) => {
      slot.classList.remove('featured-slot--loading');
      slot.removeAttribute('aria-hidden');
      if (photo) slot.append(FeaturedCard(photo));
      else slot.hidden = true;
    })
    .catch(() => {
      slot.hidden = true;
    });
  return slot;
}
