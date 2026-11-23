import '../styles/components/theme.css';

export const THEME_KEY = 'photoshare-theme';
export const THEMES = [
  { value: 'system', label: 'Як у системі' },
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
];

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
};
const listeners = new Set();

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function normalizeTheme(value) {
  return THEMES.some((theme) => theme.value === value) ? value : 'system';
}

export function readTheme(store = storage()) {
  try {
    return normalizeTheme(store?.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

export function resolveTheme(value, win = globalThis.window) {
  if (value === 'light' || value === 'dark') return value;
  return win?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function toggledTheme(value, win = globalThis.window) {
  return resolveTheme(value, win) === 'dark' ? 'light' : 'dark';
}

export function applyTheme(value, root = globalThis.document?.documentElement) {
  if (!root) return;
  const theme = normalizeTheme(value);
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function setTheme(value, { store = storage(), root } = {}) {
  const theme = normalizeTheme(value);
  try {
    if (theme === 'system') store?.removeItem(THEME_KEY);
    else store?.setItem(THEME_KEY, theme);
  } catch {
    // Сховище недоступне
  }
  applyTheme(theme, root);
  listeners.forEach((fn) => fn(theme));
  return theme;
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Зміна теми в системі
export function watchSystemTheme(win = globalThis.window) {
  const query = win?.matchMedia?.('(prefers-color-scheme: dark)');
  if (!query?.addEventListener) return () => {};
  const notify = () => {
    if (readTheme() === 'system') listeners.forEach((fn) => fn('system'));
  };
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}

export function ThemeIcon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'theme-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

// Картинка для світлої і темної теми
export function ThemedImages({ light, dark, alt = '', width, height }) {
  return [
    [light, 'on-light'],
    [dark, 'on-dark'],
  ].map(([src, className]) => {
    const img = document.createElement('img');
    img.className = className;
    img.src = src;
    img.alt = alt;
    if (width) img.width = width;
    if (height) img.height = height;
    return img;
  });
}

// Кнопка в меню
export function ThemeToggle({ className = '' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `theme-toggle ${className}`.trim();

  function render() {
    const dark = resolveTheme(readTheme()) === 'dark';
    const label = dark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.replaceChildren(ThemeIcon(dark ? 'sun' : 'moon'));
  }

  button.addEventListener('click', () => setTheme(toggledTheme(readTheme())));
  const stop = onThemeChange(render);
  render();
  return Object.assign(button, { destroy: stop });
}

// Вибір у налаштуваннях
export function ThemeSettings({ className = '' } = {}) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = `theme-settings ${className}`.trim();
  const legend = document.createElement('legend');
  legend.className = 'theme-settings__legend';
  legend.textContent = 'Тема оформлення';
  const options = document.createElement('div');
  options.className = 'theme-settings__options';

  const inputs = THEMES.map(({ value, label }) => {
    const option = document.createElement('label');
    option.className = 'theme-settings__option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'theme';
    input.value = value;
    input.className = 'theme-settings__input';
    input.addEventListener('change', () => setTheme(value));
    const text = document.createElement('span');
    text.textContent = label;
    option.append(input, text);
    options.append(option);
    return input;
  });

  function render() {
    const current = readTheme();
    inputs.forEach((input) => (input.checked = input.value === current));
  }

  fieldset.append(legend, options);
  const stop = onThemeChange(render);
  render();
  return Object.assign(fieldset, { destroy: stop });
}
