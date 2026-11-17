import { Icon } from './icons.js';

export const MONTHS = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const pad = (n) => String(n).padStart(2, '0');

// Дати в форматі API (YYYY-MM-DD). Рахуємо в UTC, щоб перехід на літній час не зсував дні
export function isoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isoWeek(value) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

// 6 тижнів з понеділка: стабільна висота календаря, дні сусідніх місяців позначені
export function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const shift = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 6 }, (_, week) => {
    const days = Array.from({ length: 7 }, (_, weekday) => {
      const date = new Date(Date.UTC(year, month, 1 - shift + week * 7 + weekday));
      return {
        date: isoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month,
        weekend: weekday >= 5,
      };
    });
    return { week: isoWeek(days[0].date), days };
  });
}

// Перший клік вибирає один день, другий розширює його до діапазону, третій починає заново
export function selectRange(range, day) {
  const { from, to } = range ?? {};
  if (from && from === to && day !== from) {
    return day < from ? { from: day, to: from } : { from, to: day };
  }
  return { from: day, to: day };
}

export function inRange(range, day) {
  return Boolean(range?.from && range?.to && day >= range.from && day <= range.to);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function navButton(icon, label, onClick) {
  const button = el('button', 'calendar__nav');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(Icon(icon, { size: '1rem' }));
  button.addEventListener('click', onClick);
  return button;
}

// Календар з вибором діапазону дат. onChange({ from, to }) після кожного кліку по дню
export function Calendar({ range = {}, today = new Date(), onChange } = {}) {
  const start = range.from ? new Date(`${range.from}T00:00:00Z`) : today;
  let year = range.from ? start.getUTCFullYear() : start.getFullYear();
  let month = range.from ? start.getUTCMonth() : start.getMonth();
  let current = { ...range };

  const root = el('div', 'calendar');
  const head = el('div', 'calendar__head');
  const title = el('p', 'calendar__title');
  title.setAttribute('aria-live', 'polite');
  head.append(
    navButton('arrowLeft', 'Попередній місяць', () => move(-1)),
    title,
    navButton('arrowRight', 'Наступний місяць', () => move(1)),
  );

  const table = el('table', 'calendar__grid');
  root.append(head, table);

  function move(delta) {
    month += delta;
    if (month < 0) [month, year] = [11, year - 1];
    if (month > 11) [month, year] = [0, year + 1];
    render();
  }

  function pick(day) {
    current = selectRange(current, day);
    render();
    onChange?.(current);
  }

  function render() {
    title.textContent = `${MONTHS[month]} ${year}`;
    table.setAttribute('aria-label', `${MONTHS[month]} ${year}`);

    const headRow = el('tr');
    const weekHead = el('th', 'calendar__week', '№');
    weekHead.scope = 'col';
    weekHead.setAttribute('aria-label', 'Тиждень');
    headRow.append(weekHead);
    WEEKDAYS.forEach((name, index) => {
      const th = el('th', index >= 5 ? 'calendar__weekend' : '', name);
      th.scope = 'col';
      headRow.append(th);
    });
    const thead = el('thead');
    thead.append(headRow);

    const tbody = el('tbody');
    for (const { week, days } of monthGrid(year, month)) {
      const row = el('tr');
      row.append(el('td', 'calendar__week', pad(week)));
      for (const day of days) {
        const cell = el('td');
        const button = el('button', 'calendar__day', String(day.day));
        button.type = 'button';
        button.dataset.date = day.date;
        if (!day.inMonth) button.classList.add('calendar__day--outside');
        if (day.weekend) button.classList.add('calendar__day--weekend');
        const selected = inRange(current, day.date);
        button.classList.toggle('calendar__day--selected', selected);
        button.classList.toggle(
          'calendar__day--edge',
          day.date === current.from || day.date === current.to,
        );
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-label', day.date.split('-').reverse().join('.'));
        button.addEventListener('click', () => pick(day.date));
        cell.append(button);
        row.append(cell);
      }
      tbody.append(row);
    }
    table.replaceChildren(thead, tbody);
  }

  render();
  return Object.assign(root, {
    setRange(next) {
      current = { ...next };
      render();
    },
  });
}
