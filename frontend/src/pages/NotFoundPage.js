import '../styles/pages/not-found.css';
import { Button } from '../components/Button.js';
import imagePng from '../assets/images/not-found@1x.png';
import image1x from '../assets/images/not-found@1x.webp';
import image2x from '../assets/images/not-found@2x.webp';
import animationUrl from '../assets/animations/not-found.lottie?url';

export function homeAction(user) {
  return user
    ? { text: 'Повернутися до світлин', href: '/home' }
    : { text: 'Повернутися на головну', href: '/' };
}

export function canAnimate(win = globalThis.window) {
  return !win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Ілюстрація
function Illustration() {
  const box = el('div', 'not-found__image');

  const picture = el('picture', 'not-found__still');
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

  const canvas = el('canvas', 'not-found__animation');
  canvas.setAttribute('aria-hidden', 'true');
  box.append(picture, canvas);

  let player = null;
  let destroyed = false;

  // Анімація в окремому потоці, коли сторінка вже показана
  function start() {
    Promise.all([
      import('@lottiefiles/dotlottie-web'),
      import('@lottiefiles/dotlottie-web/dotlottie-player.wasm?url'),
      import('@lottiefiles/dotlottie-web/dotlottie.worker.js?url'),
    ])
      .then(([{ DotLottieWorker }, { default: wasmUrl }, { default: workerUrl }]) => {
        if (destroyed) return;
        DotLottieWorker.setWasmUrl(wasmUrl);
        DotLottieWorker.setWorkerUrl(workerUrl);
        player = new DotLottieWorker({ canvas, src: animationUrl, autoplay: true, loop: true });
        player.addEventListener('load', () => box.classList.add('not-found__image--animated'));
      })
      .catch(() => {});
  }

  if (canAnimate()) {
    if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 2000 });
    else setTimeout(start, 500);
  }

  return Object.assign(box, {
    destroy() {
      destroyed = true;
      player?.destroy();
    },
  });
}

export default function NotFoundPage({ store } = {}) {
  const action = homeAction(store?.get().user);
  const root = el('section', 'not-found');

  // Заголовок
  const head = el('div', 'not-found__head');
  const title = el('h1', 'not-found__title');
  title.append(
    el('span', 'not-found__lead', 'Ooops!'),
    ' ',
    el('span', 'not-found__subtitle', 'Щось розмилося. Цей момент не збережено'),
  );
  const code = el('p', 'not-found__code', '404');
  code.setAttribute('aria-hidden', 'true');
  head.append(title, code);

  // Текст і кнопка
  const body = el('div', 'not-found__body');
  body.append(
    el(
      'p',
      'not-found__text',
      'Сторінку не знайдено. Але не засмучуйтесь — повернімося назад і знайдемо щось цікаве.',
    ),
    Button({ text: action.text, href: action.href, className: 'not-found__action' }),
  );

  const illustration = Illustration();
  root.append(head, illustration, body);
  return { el: root, destroy: () => illustration.destroy() };
}
