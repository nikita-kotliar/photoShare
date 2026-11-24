import { describe, expect, it } from 'vitest';
import { activeFilters, parseSearchQuery, searchApiQuery, searchHref } from './SearchPage.js';
import { rangeLabel } from '../components/FilterPanel.js';

describe('parseSearchQuery', () => {
  it('читає стан з адреси і відкидає некоректні значення', () => {
    expect(
      parseSearchQuery({
        q: ' море ',
        tag: '#Захід',
        rating: '9',
        from: 'bad',
        sort: 'x',
        page: '2',
      }),
    ).toEqual({
      q: 'море',
      tag: 'захід',
      color: '',
      from: '',
      to: '',
      ratingMin: 0,
      author: '',
      sort: 'new',
      page: 2,
    });
  });

  it('міняє дати місцями, якщо початок пізніше кінця', () => {
    const state = parseSearchQuery({ from: '2026-11-10', to: '2026-11-01' });
    expect([state.from, state.to]).toEqual(['2026-11-01', '2026-11-10']);
  });

  it('фільтр за автором лише для модераторів і адмінів', () => {
    expect(parseSearchQuery({ author: 'ivan' }).author).toBe('');
    expect(parseSearchQuery({ author: 'ivan' }, { staff: true }).author).toBe('ivan');
  });
});

describe('searchApiQuery і searchHref', () => {
  const state = parseSearchQuery(
    { q: 'море', rating: '4', from: '2026-11-01', to: '2026-11-10', sort: 'top', page: '3' },
    { staff: true },
  );

  it('перетворює стан на параметри API', () => {
    expect(searchApiQuery(state)).toMatchObject({
      q: 'море',
      ratingMin: 4,
      dateFrom: '2026-11-01',
      dateTo: '2026-11-10',
      sort: 'rating',
      order: 'desc',
      page: 3,
      limit: 12,
    });
    expect(searchApiQuery(parseSearchQuery({})).ratingMin).toBeUndefined();
  });

  it('адреса відновлює той самий стан', () => {
    const href = searchHref(state);
    const params = Object.fromEntries(new URLSearchParams(href.split('?')[1]));
    expect(parseSearchQuery(params, { staff: true })).toEqual(state);
    expect(searchHref(parseSearchQuery({}))).toBe('/search');
  });
});

describe('activeFilters', () => {
  it('показує чипи для тегу, дат, рейтингу й автора', () => {
    const state = parseSearchQuery(
      { tag: 'море', from: '2026-11-01', rating: '3', author: 'ivan' },
      { staff: true },
    );
    expect(activeFilters(state).map((f) => f.label)).toEqual([
      '#море',
      'з 01.11.26',
      'Рейтинг від 3',
      'Автор: ivan',
    ]);
  });

  it('підпис діапазону дат', () => {
    expect(rangeLabel({ from: '2026-11-01', to: '2026-11-10' })).toBe('01.11.26 – 10.11.26');
    expect(rangeLabel({ to: '2026-11-10' })).toBe('до 10.11.26');
    expect(rangeLabel({})).toBe('');
  });
});

describe('пошук за кольором', () => {
  it('відома група потрапляє в запит, адресу і чип, невідома відкидається', () => {
    const state = parseSearchQuery({ color: 'blue' });
    expect(state.color).toBe('blue');
    expect(searchApiQuery(state).color).toBe('blue');
    expect(searchHref(state)).toBe('/search?color=blue');
    expect(activeFilters(state)).toContainEqual({ key: 'color', label: 'Колір: синій' });
    expect(parseSearchQuery({ color: 'navy' }).color).toBe('');
  });
});
