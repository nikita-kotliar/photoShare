import { describe, expect, it } from 'vitest';
import { pluralRatings, ratingError, ratingHint, ratingMode, ratingText } from './Rating.js';

const photo = { id: 7, author: { id: 2 }, averageRating: 4.5, ratingsCount: 2, myRating: null };

describe('ratingMode', () => {
  it('гість не оцінює', () => {
    expect(ratingMode(null, photo)).toBe('guest');
  });

  it('власник не може оцінити свою світлину', () => {
    expect(ratingMode({ id: 2, role: 'ADMIN' }, photo)).toBe('owner');
  });

  it('після оцінки вибір недоступний', () => {
    expect(ratingMode({ id: 5 }, { ...photo, myRating: 4 })).toBe('rated');
    expect(ratingMode({ id: 5 }, { ...photo, rated: true })).toBe('rated');
  });

  it('інший користувач може оцінити', () => {
    expect(ratingMode({ id: 5 }, photo)).toBe('rate');
  });
});

describe('ratingText і підказки', () => {
  it('показує середнє і кількість з відмінюванням', () => {
    expect(ratingText(photo)).toBe('4.5 (2 оцінки)');
    expect(ratingText({ averageRating: null, ratingsCount: 0 })).toBe('- (0 оцінок)');
    expect(pluralRatings(1)).toBe('оцінка');
    expect(pluralRatings(11)).toBe('оцінок');
    expect(pluralRatings(21)).toBe('оцінка');
  });

  it('пояснює, чому оцінити не можна', () => {
    expect(ratingHint('owner', photo)).toBe('Свою світлину оцінити не можна');
    expect(ratingHint('rated', { myRating: 4 })).toBe('Ваша оцінка: 4 з 5');
    expect(ratingHint('rated', { rated: true })).toBe('Ви вже оцінили цю світлину');
  });

  it('перекладає помилки API', () => {
    expect(ratingError({ status: 409 })).toBe('Ви вже оцінили цю світлину');
    expect(ratingError({ status: 403, message: '' })).toBe('Цю світлину оцінити не можна');
    expect(ratingError({ status: 0, message: 'Немає з’єднання з сервером' })).toBe(
      'Немає з’єднання з сервером',
    );
  });
});
