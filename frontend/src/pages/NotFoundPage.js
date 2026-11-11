import '../styles/pages/not-found.css';
import { Button } from '../components/Button.js';
import imagePng from '../assets/images/not-found@1x.png';
import image1x from '../assets/images/not-found@1x.webp';
import image2x from '../assets/images/not-found@2x.webp';

export function homeAction(user) {
  return user
    ? { text: 'Повернутися до світлин', href: '/home' }
    : { text: 'Повернутися на головну', href: '/' };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function Illustration() {
  const picture = el('picture', 'not-found__image');
  const source = el('source');
  source.type = 'image/webp';
  source.srcset = `${image1x} 1x, ${image2x} 2x`;
  const img = el('img');
  img.src = imagePng;
  img.alt = '';
  img.width = 456;
  img.height = 464;
  img.decoding = 'async';
  picture.append(source, img);
  return picture;
}

export function StatusPage({ code, lead, title, text, action }) {
  const root = el('section', 'not-found');

  // Заголовок
  const head = el('div', 'not-found__head');
  const heading = el('h1', 'not-found__title');
  heading.append(
    el('span', 'not-found__lead', lead),
    ' ',
    el('span', 'not-found__subtitle', title),
  );
  head.append(heading);
  if (code) {
    const status = el('p', 'not-found__code', code);
    status.setAttribute('aria-hidden', 'true');
    head.append(status);
  }

  // Текст і кнопка
  const body = el('div', 'not-found__body');
  const button = Button({
    text: action.text,
    href: action.onClick ? undefined : action.href,
    className: 'not-found__action',
    onClick: action.onClick,
  });
  body.append(el('p', 'not-found__text', text), button);

  root.append(head, Illustration(), body);
  return root;
}

export default function NotFoundPage({ store } = {}) {
  return StatusPage({
    code: '404',
    lead: 'Ooops!',
    title: 'Щось розмилося. Цей момент не збережено',
    text: 'Сторінку не знайдено. Але не засмучуйтесь — повернімося назад і знайдемо щось цікаве.',
    action: homeAction(store?.get().user),
  });
}

export function ErrorPage({ retry } = {}) {
  return StatusPage({
    lead: 'Ooops!',
    title: 'Щось пішло не так',
    text: 'Сторінку не вдалося завантажити. Перевірте з’єднання і спробуйте ще раз.',
    action: { text: 'Спробувати ще раз', onClick: retry },
  });
}
