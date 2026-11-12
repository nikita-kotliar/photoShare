import { describe, expect, it } from 'vitest';
import { stripBase, withBase } from './base.js';

describe('withBase', () => {
  it('без бази шлях не змінюється', () => {
    expect(withBase('/home', '')).toBe('/home');
  });

  it('додає базу до внутрішніх шляхів', () => {
    expect(withBase('/', '/photoshare')).toBe('/photoshare/');
    expect(withBase('/photos/abc?x=1', '/photoshare')).toBe('/photoshare/photos/abc?x=1');
  });

  it('не чіпає зовнішні й відносні посилання', () => {
    expect(withBase('https://res.cloudinary.com/x.png', '/photoshare')).toBe(
      'https://res.cloudinary.com/x.png',
    );
    expect(withBase('//cdn.example.com/a.js', '/photoshare')).toBe('//cdn.example.com/a.js');
    expect(withBase('mailto:a@b.c', '/photoshare')).toBe('mailto:a@b.c');
    expect(withBase('#top', '/photoshare')).toBe('#top');
  });
});

describe('stripBase', () => {
  it('без бази шлях не змінюється', () => {
    expect(stripBase('/home', '')).toBe('/home');
  });

  it('прибирає базу', () => {
    expect(stripBase('/photoshare', '/photoshare')).toBe('/');
    expect(stripBase('/photoshare/', '/photoshare')).toBe('/');
    expect(stripBase('/photoshare/users/nikita', '/photoshare')).toBe('/users/nikita');
  });

  it('не плутає схожий префікс', () => {
    expect(stripBase('/photoshare-api/users', '/photoshare')).toBe('/photoshare-api/users');
  });

  it('withBase і stripBase взаємно обернені', () => {
    for (const path of ['/', '/home', '/photos/1', '/auth']) {
      expect(stripBase(withBase(path, '/photoshare'), '/photoshare')).toBe(path);
    }
  });
});
