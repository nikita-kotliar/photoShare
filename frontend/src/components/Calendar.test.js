import { describe, expect, it } from 'vitest';
import { inRange, isoDate, isoWeek, monthGrid, selectRange } from './Calendar.js';

describe('monthGrid', () => {
  it('6 тижнів з понеділка, дні сусідніх місяців позначені', () => {
    const grid = monthGrid(2026, 1); // 1 лютого 2026 - неділя
    expect(grid).toHaveLength(6);
    expect(grid.every((week) => week.days.length === 7)).toBe(true);
    expect(grid[0].days[0]).toMatchObject({ date: '2026-01-26', inMonth: false });
    expect(grid[0].days[6]).toMatchObject({ date: '2026-02-01', inMonth: true, weekend: true });
    expect(grid[0].week).toBe(5);
  });

  it('переходить через рік', () => {
    expect(monthGrid(2026, 11).at(-1).days.at(-1).date).toBe('2027-01-10');
  });
});

describe('isoWeek і isoDate', () => {
  it('номер тижня за ISO 8601', () => {
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2026-12-28')).toBe(53);
    expect(isoWeek('2027-01-01')).toBe(53);
  });

  it('нормалізує переповнення дня', () => {
    expect(isoDate(2026, 1, 29)).toBe('2026-03-01');
  });
});

describe('selectRange', () => {
  it('перший клік - один день, другий - діапазон, третій - заново', () => {
    const one = selectRange({}, '2026-02-10');
    expect(one).toEqual({ from: '2026-02-10', to: '2026-02-10' });
    const range = selectRange(one, '2026-02-03');
    expect(range).toEqual({ from: '2026-02-03', to: '2026-02-10' });
    expect(selectRange(range, '2026-02-20')).toEqual({ from: '2026-02-20', to: '2026-02-20' });
  });

  it('inRange включає межі', () => {
    const range = { from: '2026-02-03', to: '2026-02-10' };
    expect(inRange(range, '2026-02-03')).toBe(true);
    expect(inRange(range, '2026-02-10')).toBe(true);
    expect(inRange(range, '2026-02-11')).toBe(false);
    expect(inRange({}, '2026-02-03')).toBe(false);
  });
});
