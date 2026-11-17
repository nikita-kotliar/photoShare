import '../styles/pages/home.css';
import '../styles/pages/search.css';
import { photosApi } from '../api/photos.js';
import { searchApi } from '../api/search.js';
import { Button } from '../components/Button.js';
import { Dropdown } from '../components/Dropdown.js';
import { FilterPanel, rangeLabel } from '../components/FilterPanel.js';
import { Icon } from '../components/icons.js';
import { isStaff } from '../components/navigation.js';
import { PhotoCard } from '../components/PhotoCard.js';
import { SearchInput } from '../components/SearchInput.js';
import { pushToast } from '../store/index.js';
import { parsePage } from './HomePage.js';

export const SEARCH_LIMIT = 12;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const SEARCH_SORTS = [
  { value: 'new', label: 'Спочатку нові', query: { sort: 'date', order: 'desc' } },
  { value: 'old', label: 'Спочатку старі', query: { sort: 'date', order: 'asc' } },
  { value: 'top', label: 'Найвищий рейтинг', query: { sort: 'rating', order: 'desc' } },
  { value: 'low', label: 'Найнижчий рейтинг', query: { sort: 'rating', order: 'asc' } },
];

const DEFAULTS = {
  q: '',
  tag: '',
  from: '',
  to: '',
  ratingMin: 0,
  author: '',
  sort: 'new',
  page: 1,
};

function validDate(value) {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value))
    ? value
    : '';
}

export function parseSearchQuery(query = {}, { staff = false } = {}) {
  let from = validDate(query.from);
  let to = validDate(query.to);
  if (from && to && from > to) [from, to] = [to, from];
  const rating = Number.parseInt(query.rating, 10);
  const text = (value, max) =>
    String(value ?? '')
      .trim()
      .slice(0, max);
  return {
    q: text(query.q, 100),
    tag: text(query.tag, 30).replace(/^#/, '').toLowerCase(),
    from,
    to,
    ratingMin: rating >= 1 && rating <= 5 ? rating : 0,
    author: staff ? text(query.author, 30) : '',
    sort: SEARCH_SORTS.some((s) => s.value === query.sort) ? query.sort : 'new',
    page: parsePage(query.page),
  };
}

export function searchApiQuery(state, limit = SEARCH_LIMIT) {
  const sort = SEARCH_SORTS.find((s) => s.value === state.sort) ?? SEARCH_SORTS[0];
  return {
    q: state.q,
    tag: state.tag,
    dateFrom: state.from,
    dateTo: state.to,
    ratingMin: state.ratingMin || undefined,
    username: state.author,
    ...sort.query,
    page: state.page,
    limit,
  };
}

export function searchHref(state) {
  const params = new URLSearchParams();
  const keys = {
    q: 'q',
    tag: 'tag',
    from: 'from',
    to: 'to',
    ratingMin: 'rating',
    author: 'author',
  };
  for (const [key, name] of Object.entries(keys)) {
    if (state[key] && state[key] !== DEFAULTS[key]) params.set(name, state[key]);
  }
  if (state.sort && state.sort !== DEFAULTS.sort) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', state.page);
  const search = params.toString();
  return search ? `/search?${search}` : '/search';
}

export function activeFilters(state) {
  const list = [];
  if (state.tag) list.push({ key: 'tag', label: `#${state.tag}` });
  const dates = rangeLabel(state);
  if (dates) list.push({ key: 'dates', label: dates });
  if (state.ratingMin) list.push({ key: 'ratingMin', label: `Рейтинг від ${state.ratingMin}` });
  if (state.author) list.push({ key: 'author', label: `Автор: ${state.author}` });
  return list;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
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

function Skeleton() {
  const item = el('li', 'home__item');
  const card = el('div', 'home-skeleton');
  card.append(
    el('div', 'home-skeleton__media'),
    el('div', 'home-skeleton__line home-skeleton__line--wide'),
    el('div', 'home-skeleton__line'),
  );
  item.append(card);
  return item;
}

function Message(title, text, action) {
  const box = el('div', 'home__message');
  box.append(el('p', 'home__message-title', title), el('p', 'home__message-text', text));
  if (action) box.append(action);
  return box;
}

export default function SearchPage({ query, store, navigate }) {
  const user = store.get().user;
  const staff = isStaff(user);
  const state = parseSearchQuery(query, { staff });
  const controller = new AbortController();
  const cleanups = [() => controller.abort()];

  const root = el('section', 'search-page container');
  root.setAttribute('aria-labelledby', 'search-title');
  const title = el('h1', 'search-page__title', 'Пошук світлин');
  title.id = 'search-title';

  function update(patch) {
    navigate(searchHref({ ...state, page: 1, ...patch }));
  }

  // Пошук, фільтр і сортування
  const bar = el('div', 'search-page__bar');
  const search = SearchInput({
    placeholder: 'Пошук за описом або тегом',
    value: state.q,
    onSearch: (q) => update({ q: q.trim() }),
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
      update({
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
    options: SEARCH_SORTS.map(({ value, label }) => ({ value, label })),
    value: state.sort,
    onChange: (value) => update({ sort: value }),
  });
  sort.classList.add('search-page__sort');
  cleanups.push(() => sort.destroy());
  tools.append(filterWrap, sort);
  bar.append(search, tools);

  // Активні фільтри
  const chips = el('ul', 'search-page__chips');
  chips.setAttribute('role', 'list');
  const filters = activeFilters(state);
  for (const filter of filters) {
    const item = el('li');
    const chip = el('button', 'search-page__chip');
    chip.type = 'button';
    chip.setAttribute('aria-label', `Прибрати фільтр: ${filter.label}`);
    chip.append(el('span', '', filter.label), Icon('close', { size: '0.625rem' }));
    chip.addEventListener('click', () => {
      if (filter.key === 'dates') update({ from: '', to: '' });
      else update({ [filter.key]: DEFAULTS[filter.key] });
    });
    item.append(chip);
    chips.append(item);
  }
  chips.hidden = filters.length === 0;

  const status = el('p', 'search-page__status');
  status.setAttribute('role', 'status');
  const list = el('ul', 'home__grid');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-busy', 'true');
  list.append(...Array.from({ length: 6 }, Skeleton));

  root.append(title, bar, chips, status, list);

  async function onDelete(photo, event) {
    const button = event.currentTarget;
    const label = button.querySelector('.btn__text');
    if (button.dataset.confirm !== 'true') {
      button.dataset.confirm = 'true';
      label.textContent = 'Точно видалити?';
      button.addEventListener(
        'blur',
        () => {
          delete button.dataset.confirm;
          label.textContent = 'Видалити';
        },
        { once: true },
      );
      return;
    }
    button.disabled = true;
    try {
      await photosApi.remove(photo.id);
      pushToast('Світлину видалено', 'success');
      load();
    } catch (error) {
      button.disabled = false;
      pushToast(error.message || 'Не вдалося видалити світлину', 'error');
    }
  }

  function Pagination(pages) {
    const nav = el('nav', 'home__pagination');
    nav.setAttribute('aria-label', 'Сторінки результатів');
    const isFirst = state.page <= 1;
    const isLast = state.page >= pages;
    nav.append(
      Button({
        text: 'Назад',
        variant: 'secondary',
        href: isFirst ? undefined : searchHref({ ...state, page: state.page - 1 }),
        arrowLeft: true,
        disabled: isFirst,
      }),
      Button({
        text: 'Далі',
        href: isLast ? undefined : searchHref({ ...state, page: state.page + 1 }),
        arrowRight: true,
        disabled: isLast,
      }),
    );
    return nav;
  }

  // Результати
  async function load() {
    let current = root.querySelector('.home__grid, .home__message');
    root.querySelector('.home__pagination')?.remove();
    try {
      const data = await searchApi.photos(searchApiQuery(state), { signal: controller.signal });
      if (data.pages > 0 && state.page > data.pages) {
        navigate(searchHref({ ...state, page: data.pages }), { replace: true });
        return;
      }
      status.textContent = data.total ? `Знайдено світлин: ${data.total}` : 'Нічого не знайдено';

      if (data.items.length === 0) {
        const hasQuery = state.q || filters.length;
        const reset = hasQuery
          ? Button({ text: 'Скинути пошук', variant: 'secondary', href: '/search' })
          : null;
        current.replaceWith(
          Message(
            'Нічого не знайдено',
            hasQuery
              ? 'Спробуйте інше слово або приберіть частину фільтрів'
              : 'Тут поки немає світлин',
            reset,
          ),
        );
        return;
      }

      const grid = el('ul', 'home__grid');
      grid.setAttribute('role', 'list');
      grid.append(
        ...data.items.map((photo) => {
          const item = el('li', 'home__item');
          item.append(
            PhotoCard(photo, {
              user,
              headingLevel: 2,
              onEdit: () => navigate(`/photos/${photo.slug ?? photo.id}`),
              onDelete,
            }),
          );
          return item;
        }),
      );
      current.replaceWith(grid);
      if (data.pages > 1) root.append(Pagination(data.pages));
    } catch (error) {
      if (error.name === 'AbortError') return;
      status.textContent = 'Помилка пошуку';
      const retry = Button({ text: 'Спробувати ще', onClick: load });
      current.replaceWith(
        Message('Не вдалося виконати пошук', error.message || 'Спробуйте пізніше', retry),
      );
    }
  }

  load();
  return { el: root, destroy: () => cleanups.forEach((fn) => fn()) };
}
