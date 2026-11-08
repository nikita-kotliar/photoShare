import { Icon } from './icons.js';

// Випадаюче меню
export function Dropdown({
  trigger,
  label,
  options = [],
  value,
  selectable = true,
  onChange,
} = {}) {
  const root = document.createElement('div');
  root.className = 'dropdown';

  const menu = document.createElement('ul');
  menu.className = 'dropdown__menu';
  menu.setAttribute('role', selectable ? 'listbox' : 'menu');
  if (label) menu.setAttribute('aria-label', label);
  menu.hidden = true;

  trigger.setAttribute('aria-haspopup', selectable ? 'listbox' : 'menu');
  trigger.setAttribute('aria-expanded', 'false');

  let current = value;
  const items = options.map((option) => {
    const item = document.createElement('li');
    item.className = 'dropdown__item';
    item.tabIndex = -1;
    item.dataset.value = option.value;
    item.setAttribute('role', selectable ? 'option' : 'menuitem');
    if (option.icon) item.append(Icon(option.icon, { size: 16 }));
    item.append(document.createTextNode(option.label));
    item.addEventListener('click', () => choose(option));
    return item;
  });
  menu.append(...items);

  function render() {
    if (!selectable) return;
    for (const item of items) {
      const selected = item.dataset.value === String(current);
      item.classList.toggle('dropdown__item--selected', selected);
      item.setAttribute('aria-selected', String(selected));
    }
  }

  function open() {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const active = items.find((item) => item.dataset.value === String(current)) || items[0];
    active?.focus();
    document.addEventListener('click', onOutside, true);
  }

  function close({ focusTrigger = false } = {}) {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutside, true);
    if (focusTrigger) trigger.focus();
  }

  function choose(option) {
    current = option.value;
    render();
    close({ focusTrigger: true });
    onChange?.(option.value, option);
  }

  function onOutside(event) {
    if (!root.contains(event.target)) close();
  }

  trigger.addEventListener('click', () => (menu.hidden ? open() : close()));

  menu.addEventListener('keydown', (event) => {
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (index >= 0) choose(options[index]);
    } else if (event.key === 'Escape') {
      close({ focusTrigger: true });
    } else if (event.key === 'Tab') {
      close();
    }
  });

  render();
  root.append(trigger, menu);

  return Object.assign(root, {
    close,
    getValue: () => current,
    destroy: () => document.removeEventListener('click', onOutside, true),
  });
}
