import { describe, expect, it } from 'vitest';
import { formatCommentDate } from './PhotoPage.js';

describe('formatCommentDate', () => {
  const now = new Date(2026, 10, 8, 12, 0);

  it('пише «Сьогодні» і «Вчора»', () => {
    expect(formatCommentDate(new Date(2026, 10, 8, 9, 5).toISOString(), now)).toBe(
      'Сьогодні о 09:05',
    );
    expect(formatCommentDate(new Date(2026, 10, 7, 15, 30).toISOString(), now)).toBe(
      'Вчора о 15:30',
    );
  });

  it('показує дату для старіших коментарів', () => {
    expect(formatCommentDate(new Date(2025, 1, 10, 20, 40).toISOString(), now)).toBe(
      '10.02.2025 о 20:40',
    );
    expect(formatCommentDate('bad', now)).toBe('');
  });
});
