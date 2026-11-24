import { describe, expect, it } from 'vitest';
import { featuredMeta } from './FeaturedPhoto.js';

describe('featuredMeta', () => {
  it('автор і рейтинг, без автора лише рейтинг', () => {
    const photo = {
      averageRating: 4.5,
      ratingsCount: 2,
      author: { name: 'Анна', username: 'anna' },
    };
    expect(featuredMeta(photo)).toBe('Анна · 4.5 (2 оцінки)');
    expect(featuredMeta({ ...photo, author: null })).toBe('4.5 (2 оцінки)');
  });
});
