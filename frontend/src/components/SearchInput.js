import { Icon } from './icons.js';

// Поле пошуку
export function SearchInput({
  name = 'q',
  value = '',
  placeholder = 'Пошук',
  label = 'Пошук',
  onSearch,
} = {}) {
  const form = document.createElement('form');
  form.className = 'search';
  form.setAttribute('role', 'search');

  const icon = Icon('search', { size: 20 });
  icon.classList.add('search__icon');

  const input = document.createElement('input');
  input.className = 'search__input';
  input.type = 'search';
  input.name = name;
  input.value = value;
  input.placeholder = placeholder;
  input.setAttribute('aria-label', label);
  input.autocomplete = 'off';

  form.append(icon, input);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onSearch?.(input.value.trim());
  });

  return Object.assign(form, { input });
}
