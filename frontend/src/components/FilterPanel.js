import { Button } from './Button.js';
import { Calendar } from './Calendar.js';
import { Icon } from './icons.js';

export const RATING_STEPS = [1, 2, 3, 4, 5];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function shortDate(value) {
  const [y, m, d] = value.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

export function rangeLabel({ from, to } = {}) {
  if (!from && !to) return '';
  if (from && to) return from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;
  return from ? `з ${shortDate(from)}` : `до ${shortDate(to)}`;
}

// Панель фільтрів
export function FilterPanel({ value = {}, staff = false, onApply, onReset }) {
  let draft = { from: '', to: '', ratingMin: 0, author: '', ...value };
  const panel = el('div', 'filter-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Фільтри');

  // Дата
  const dateGroup = el('div', 'filter-panel__group');
  const dateTitle = el('p', 'filter-panel__title', 'За датою публікації');
  dateTitle.id = 'filter-date-title';
  const dateRow = el('div', 'filter-panel__date');
  const dateField = el('p', 'filter-panel__field');
  dateField.append(Icon('search', { size: '1rem' }));
  const dateText = el('span', 'filter-panel__field-text');
  dateField.append(dateText);
  const dateButton = el('button', 'filter-panel__calendar-button');
  dateButton.type = 'button';
  dateButton.setAttribute('aria-label', 'Обрати діапазон дат');
  dateButton.setAttribute('aria-expanded', 'false');
  dateButton.append(Icon('calendar', { size: '1.5rem' }));
  dateRow.append(dateField, dateButton);
  const calendar = Calendar({
    range: { from: draft.from, to: draft.to },
    onChange: ({ from, to }) => {
      draft = { ...draft, from: from ?? '', to: to ?? '' };
      syncDate();
    },
  });
  calendar.hidden = true;
  dateButton.addEventListener('click', () => {
    calendar.hidden = !calendar.hidden;
    dateButton.setAttribute('aria-expanded', String(!calendar.hidden));
  });
  dateGroup.append(dateTitle, dateRow, calendar);

  function syncDate() {
    const label = rangeLabel(draft);
    dateText.textContent = label || 'Оберіть день або період';
    dateField.classList.toggle('filter-panel__field--empty', !label);
  }

  // Рейтинг
  const ratingGroup = el('fieldset', 'filter-panel__group');
  ratingGroup.append(el('legend', 'filter-panel__title', 'За рейтингом'));
  const stars = el('div', 'filter-panel__stars');
  const starButtons = RATING_STEPS.map((step) => {
    const button = el('button', 'filter-panel__star');
    button.type = 'button';
    button.setAttribute('aria-label', `Від ${step} зірок`);
    button.append(Icon('starFilled', { size: '1.5rem' }));
    button.addEventListener('click', () => {
      draft = { ...draft, ratingMin: draft.ratingMin === step ? 0 : step };
      syncStars();
    });
    return button;
  });
  stars.append(...starButtons);
  ratingGroup.append(stars);

  function syncStars() {
    starButtons.forEach((button, i) => {
      button.classList.toggle('filter-panel__star--on', i < draft.ratingMin);
      button.setAttribute('aria-pressed', String(i + 1 === draft.ratingMin));
    });
  }

  panel.append(dateGroup, ratingGroup);

  // Автор
  let authorInput = null;
  if (staff) {
    const authorGroup = el('div', 'filter-panel__group');
    const label = el('label', 'filter-panel__title', 'За автором');
    label.htmlFor = 'filter-author';
    authorInput = el('input', 'filter-panel__input');
    authorInput.id = 'filter-author';
    authorInput.placeholder = 'Введіть UserName';
    authorInput.autocomplete = 'off';
    authorInput.value = draft.author;
    authorInput.addEventListener('input', () => {
      draft = { ...draft, author: authorInput.value.trim() };
    });
    authorGroup.append(label, authorInput);
    panel.append(authorGroup);
  }

  // Кнопки
  const actions = el('div', 'filter-panel__actions');
  const reset = Button({ text: 'Скинути', variant: 'secondary', size: 'xs' });
  reset.addEventListener('click', () => {
    draft = { from: '', to: '', ratingMin: 0, author: '' };
    calendar.setRange({});
    if (authorInput) authorInput.value = '';
    syncDate();
    syncStars();
    onReset?.();
  });
  const apply = Button({ text: 'Застосувати', size: 'xs' });
  apply.addEventListener('click', () => onApply?.({ ...draft }));
  actions.append(reset, apply);
  panel.append(actions);

  syncDate();
  syncStars();
  return Object.assign(panel, {
    setValue(next) {
      draft = { from: '', to: '', ratingMin: 0, author: '', ...next };
      calendar.setRange({ from: draft.from, to: draft.to });
      if (authorInput) authorInput.value = draft.author;
      syncDate();
      syncStars();
    },
  });
}
