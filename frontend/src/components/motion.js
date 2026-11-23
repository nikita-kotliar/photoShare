import '../styles/components/motion.css';

let hero = { id: null, node: null };

export const REVEAL_STEP = 70;
export const REVEAL_MAX_STEPS = 6;
export const REVEAL_THRESHOLD = 0.1;
export const CONFETTI_COUNT = 70;
const RIPPLE_TIME = 800;
export const CONFETTI_COLORS = [
  'var(--color-accent)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-gold)',
  'var(--color-primary)',
];

export function reducedMotion(win = globalThis.window) {
  return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function revealDelay(order) {
  return Math.min(order, REVEAL_MAX_STEPS - 1) * REVEAL_STEP;
}

// Поява карток
export function reveal(items, { win = globalThis.window } = {}) {
  const nodes = [...items];
  if (!nodes.length || reducedMotion(win) || !win?.IntersectionObserver) return () => {};
  const observer = new win.IntersectionObserver(
    (entries) => {
      let order = 0;
      for (const entry of entries) {
        // Картка пішла з екрана - наступного разу з'явиться знову
        if (!entry.isIntersecting) {
          entry.target.classList.remove('reveal--in');
          continue;
        }
        if (entry.intersectionRatio < REVEAL_THRESHOLD) continue;
        if (entry.target.classList.contains('reveal--in')) continue;
        entry.target.style.setProperty('--reveal-delay', `${revealDelay(order)}ms`);
        entry.target.classList.add('reveal--in');
        order += 1;
      }
    },
    { threshold: [0, REVEAL_THRESHOLD] },
  );
  for (const node of nodes) {
    if (hero.node && node.contains?.(hero.node)) continue;
    node.classList.add('reveal');
    observer.observe(node);
  }
  return () => observer.disconnect();
}

// Хвиля від натискання
export function installRipple(doc = document) {
  function onPointerDown(event) {
    if (event.button !== 0 || reducedMotion(doc.defaultView)) return;
    const target = event.target.closest?.('.btn, .icon-btn');
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const wave = doc.createElement('span');
    wave.className = 'ripple';
    wave.setAttribute('aria-hidden', 'true');
    wave.style.width = `${size}px`;
    wave.style.height = `${size}px`;
    wave.style.left = `${event.clientX - rect.left - size / 2}px`;
    wave.style.top = `${event.clientY - rect.top - size / 2}px`;
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
    setTimeout(() => wave.remove(), RIPPLE_TIME);
    target.append(wave);
  }
  doc.addEventListener('pointerdown', onPointerDown);
  return () => doc.removeEventListener('pointerdown', onPointerDown);
}

// Плавна зміна числа
export function countUp(from, to, { duration = 600, onUpdate, win = globalThis.window } = {}) {
  const start = Number(from);
  const end = Number(to);
  if (
    from === null ||
    to === null ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start === end ||
    reducedMotion(win) ||
    !win?.requestAnimationFrame
  ) {
    onUpdate(to);
    return;
  }
  const began = win.performance.now();
  function step(now) {
    const t = Math.min((now - began) / duration, 1);
    const eased = 1 - (1 - t) ** 3;
    onUpdate(t === 1 ? to : start + (end - start) * eased);
    if (t < 1) win.requestAnimationFrame(step);
  }
  win.requestAnimationFrame(step);
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

// Конфеті
export function confetti({ count = CONFETTI_COUNT, doc = document } = {}) {
  if (reducedMotion(doc.defaultView)) return null;
  const layer = doc.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  let left = count;
  for (let i = 0; i < count; i += 1) {
    const piece = doc.createElement('span');
    piece.className = 'confetti__piece';
    piece.style.setProperty('--x', `${random(0, 100)}vw`);
    piece.style.setProperty('--dx', `${random(-15, 15)}vw`);
    piece.style.setProperty('--rot', `${random(360, 1080)}deg`);
    piece.style.setProperty('--delay', `${random(0, 300)}ms`);
    piece.style.setProperty('--duration', `${random(1600, 2600)}ms`);
    piece.style.setProperty('--color', CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    piece.addEventListener('animationend', () => {
      left -= 1;
      if (left === 0) layer.remove();
    });
    layer.append(piece);
  }
  doc.body.append(layer);
  setTimeout(() => layer.remove(), 4000);
  return layer;
}

// Перехід між сторінками
export const HERO_NAME = 'photo-hero';
export const TRANSITION_WAIT = 500;

export function canTransition(doc = globalThis.document) {
  return Boolean(doc?.startViewTransition) && !reducedMotion(doc.defaultView);
}

export function markHero(node, id) {
  if (hero.node && hero.node !== node) hero.node.style.viewTransitionName = '';
  hero = { id, node };
  if (node) node.style.viewTransitionName = HERO_NAME;
}

export function isHero(id) {
  return id !== null && id !== undefined && hero.id === id;
}

export function withTimeout(promise, ms = TRANSITION_WAIT) {
  return Promise.race([
    Promise.resolve(promise).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
}

// Колаж пливе при прокрутці
export function drift(node, { win = globalThis.window, strength = 0.08 } = {}) {
  if (!node || reducedMotion(win) || !win?.requestAnimationFrame) return () => {};
  let frame = 0;
  function update() {
    frame = 0;
    const rect = node.getBoundingClientRect();
    const view = win.innerHeight || 1;
    const progress = Math.min(Math.max((view - rect.top) / (view + rect.height), 0), 1);
    node.style.setProperty('--drift', `${((progress - 0.5) * strength * 100).toFixed(2)}%`);
  }
  function onScroll() {
    if (!frame) frame = win.requestAnimationFrame(update);
  }
  win.addEventListener('scroll', onScroll, { passive: true });
  win.addEventListener('resize', onScroll, { passive: true });
  node.classList.add('drift');
  update();
  return () => {
    win.removeEventListener('scroll', onScroll);
    win.removeEventListener('resize', onScroll);
    if (frame) win.cancelAnimationFrame?.(frame);
  };
}
