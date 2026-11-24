import '../styles/components/before-after.css';

export function clampPosition(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.min(100, Math.max(0, number));
}

export function BeforeAfter({ before, after, alt = '' }) {
  const root = document.createElement('div');
  root.className = 'before-after';
  root.style.setProperty('--pos', '50%');

  const afterImg = document.createElement('img');
  afterImg.className = 'before-after__img';
  afterImg.src = after;
  afterImg.alt = alt;

  const beforeWrap = document.createElement('div');
  beforeWrap.className = 'before-after__before';
  const beforeImg = document.createElement('img');
  beforeImg.className = 'before-after__img';
  beforeImg.src = before;
  beforeImg.alt = '';
  beforeWrap.append(beforeImg);

  const line = document.createElement('span');
  line.className = 'before-after__line';
  line.setAttribute('aria-hidden', 'true');

  const labels = document.createElement('span');
  labels.className = 'before-after__labels';
  labels.setAttribute('aria-hidden', 'true');
  const left = document.createElement('span');
  left.textContent = 'До';
  const right = document.createElement('span');
  right.textContent = 'Після';
  labels.append(left, right);

  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.value = '50';
  range.className = 'before-after__range';
  range.setAttribute('aria-label', 'Порівняння: ліворуч оригінал, праворуч результат');
  range.addEventListener('input', () => {
    root.style.setProperty('--pos', `${clampPosition(range.value)}%`);
  });

  root.append(afterImg, beforeWrap, line, labels, range);
  return root;
}
