import { describe, expect, it } from 'vitest';
import { pageHref, parsePage } from './HomePage.js';

describe('parsePage', () => {
  it('бере номер сторінки з query', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-2')).toBe(1);
    expect(parsePage('abc')).toBe(1);
  });
});

describe('pageHref', () => {
  it('будує посилання на сторінку', () => {
    expect(pageHref(1)).toBe('/home');
    expect(pageHref(2)).toBe('/home?page=2');
  });
});
