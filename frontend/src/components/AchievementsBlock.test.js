import { describe, expect, it } from 'vitest';
import { badgeList, formatEarned } from './AchievementsBlock.js';
import { achievementIcon, knownAchievements } from './AchievementToast.js';
import { achievementTitle } from '../achievements.js';

describe('badgeList', () => {
  it('усі п’ять у порядку каталогу, отримані з датою', () => {
    const list = badgeList([
      { code: 'CRITIC', earned: true, earnedAt: '2026-11-20T10:00:00Z' },
      { code: 'FIRST_PHOTO', earned: true, earnedAt: '2026-11-01T10:00:00Z' },
    ]);
    expect(list.map((b) => [b.code, b.earned])).toEqual([
      ['FIRST_PHOTO', true],
      ['TEN_PHOTOS', false],
      ['COMMENTATOR', false],
      ['CRITIC', true],
      ['FAVORITE', false],
    ]);
    expect(list[1]).toMatchObject({ title: '10 публікацій', hint: 'Опублікуйте 10 світлин' });
  });

  it('без даних - усі неотримані', () => {
    expect(badgeList().every((b) => !b.earned && b.earnedAt === null)).toBe(true);
  });
});

describe('formatEarned', () => {
  it('дата отримання', () => {
    expect(formatEarned('2026-11-20T10:00:00Z')).toMatch(/^Отримано \d{2}\.\d{2}\.2026/);
    expect(formatEarned('bad')).toBe('');
  });
});

describe('тост досягнень', () => {
  it('лише відомі коди, без повторів', () => {
    expect(knownAchievements(['CRITIC', 'NEW_THING', 'CRITIC', 'FIRST_PHOTO'])).toEqual([
      'CRITIC',
      'FIRST_PHOTO',
    ]);
    expect(knownAchievements(undefined)).toEqual([]);
  });

  it('іконка і назва для кожного коду, запасні для невідомого', () => {
    expect(achievementIcon('FAVORITE')).toBe('❤️');
    expect(achievementIcon('X')).toBe('🏆');
    expect(achievementTitle('COMMENTATOR')).toBe('Коментатор');
    expect(achievementTitle('X')).toBe('Нове досягнення');
  });
});
