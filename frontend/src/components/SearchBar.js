import '../styles/pages/search.css';
import { Dropdown } from './Dropdown.js';
import { FilterPanel } from './FilterPanel.js';
import { Icon } from './icons.js';
import { SearchInput } from './SearchInput.js';

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function toolButton(icon, label) {
  const button = el('button', 'search-page__tool');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(Icon(icon, { size: '1.25rem' }));
  return button;
}

export function SearchBar({ state, staff = false, sorts, onChange }) {
  const cleanups = [];
  const bar = el('div', 'search-page__bar');
  const search = SearchInput({
    placeholder: 'Опис або тег',
    label: 'Пошук за описом або тегом',
    value: state.q,
    onSearch: (q) => onChange({ q: q.trim() }),
  });
  search.classList.add('search-page__search');

  const tools = el('div', 'search-page__tools');
  const filterWrap = el('div', 'search-page__filter');
  const filterButton = toolButton('filter', 'Фільтри');
  filterButton.setAttribute('aria-haspopup', 'dialog');
  filterButton.setAttribute('aria-expanded', 'false');
  const panel = FilterPanel({
    value: state,
    staff,
    onApply: (value) => {
      togglePanel(false);
      onChange({
        from: value.from,
        to: value.to,
        ratingMin: value.ratingMin,
        author: staff ? value.author : '',
      });
    },
    onReset: () => {},
  });
  panel.hidden = true;
  filterWrap.append(filterButton, panel);

  function togglePanel(open = panel.hidden) {
    panel.hidden = !open;
    filterButton.setAttribute('aria-expanded', String(open));
    filterButton.classList.toggle('search-page__tool--active', open);
    if (open) document.addEventListener('click', onOutside, true);
    else document.removeEventListener('click', onOutside, true);
  }
  function onOutside(event) {
    if (!filterWrap.contains(event.target)) togglePanel(false);
  }
  filterButton.addEventListener('click', () => togglePanel());
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      togglePanel(false);
      filterButton.focus();
    }
  });
  cleanups.push(() => document.removeEventListener('click', onOutside, true));

  const sortButton = toolButton('sort', 'Сортування');
  const sort = Dropdown({
    trigger: sortButton,
    label: 'Сортування',
    options: sorts.map(({ value, label }) => ({ value, label })),
    value: state.sort,
    onChange: (value) => onChange({ sort: value }),
  });
  sort.classList.add('search-page__sort');
  cleanups.push(() => sort.destroy());
  tools.append(filterWrap, sort);
  bar.append(search, tools);

  return Object.assign(bar, { destroy: () => cleanups.forEach((fn) => fn()) });
}
