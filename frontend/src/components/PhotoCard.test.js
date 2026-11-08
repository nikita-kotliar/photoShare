import { describe, expect, it } from 'vitest';
import { canManagePhoto, formatPhotoDate, photoCardMode, plural } from './PhotoCard.js';

const photo = { id: 1, author: { id: 2 } };

describe('photoCardMode', () => {
  it('визначає варіант картки', () => {
    expect(photoCardMode({ id: 2, role: 'USER' }, photo)).toBe('owner');
    expect(photoCardMode({ id: 2, role: 'ADMIN' }, photo)).toBe('owner');
    expect(photoCardMode({ id: 5, role: 'ADMIN' }, photo)).toBe('admin');
    expect(photoCardMode({ id: 5, role: 'USER' }, photo)).toBe('guest');
    expect(photoCardMode(null, photo)).toBe('guest');
  });
});

describe('canManagePhoto', () => {
  it('дозволяє автору і адміну', () => {
    expect(canManagePhoto({ id: 2, role: 'USER' }, photo)).toBe(true);
    expect(canManagePhoto({ id: 5, role: 'ADMIN' }, photo)).toBe(true);
  });

  it('забороняє іншим і гостю', () => {
    expect(canManagePhoto({ id: 5, role: 'USER' }, photo)).toBe(false);
    expect(canManagePhoto({ id: 5, role: 'MODERATOR' }, photo)).toBe(false);
    expect(canManagePhoto(null, photo)).toBe(false);
  });
});

describe('formatPhotoDate', () => {
  it('форматує дату', () => {
    expect(formatPhotoDate('2025-02-10T20:40:00')).toBe('10.02.2025 20:40');
    expect(formatPhotoDate('bad')).toBe('');
  });
});

describe('plural', () => {
  it('підбирає форму слова', () => {
    const forms = ['оцінка', 'оцінки', 'оцінок'];
    expect(plural(1, forms)).toBe('оцінка');
    expect(plural(3, forms)).toBe('оцінки');
    expect(plural(12, forms)).toBe('оцінок');
    expect(plural(120, forms)).toBe('оцінок');
    expect(plural(21, forms)).toBe('оцінка');
  });
});
