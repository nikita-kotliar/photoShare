import { describe, expect, it } from 'vitest';
import { badgeText, notificationHref, notificationText, timeAgo } from './NotificationBell.js';

const actor = { id: 4, username: 'ivan', name: 'Іван Шевченко', avatarUrl: null };
const photo = { id: 7, slug: 'abc123', url: 'https://example.com/7.png' };

describe('badgeText', () => {
  it('порожній без непрочитаних, 99+ для великих чисел', () => {
    expect(badgeText(0)).toBe('');
    expect(badgeText(undefined)).toBe('');
    expect(badgeText(5)).toBe('5');
    expect(badgeText(100)).toBe('99+');
  });
});

describe('notificationText', () => {
  it('коментар показує автора і текст', () => {
    expect(notificationText({ type: 'COMMENT', actor, data: { text: 'Гарно!' } })).toEqual({
      title: 'Новий коментар до вашої світлини',
      text: 'Іван Шевченко: «Гарно!»',
    });
  });

  it('оцінка показує значення', () => {
    expect(notificationText({ type: 'RATING', actor, data: { value: 4 } })).toEqual({
      title: 'Оцінка 4 з 5 вашій світлині',
      text: 'Іван Шевченко',
    });
  });

  it('досягнення називає значок', () => {
    expect(
      notificationText({ type: 'ACHIEVEMENT', actor: null, data: { code: 'CRITIC' } }).title,
    ).toBe('Нове досягнення: «Критик»');
  });

  it('модератор і невідомий тип', () => {
    expect(notificationText({ type: 'MODERATOR', actor, data: {} }).title).toBe(
      'Вас призначено модератором',
    );
    expect(notificationText({ type: 'OTHER', data: {} }).title).toBe('Нове сповіщення');
  });
});

describe('notificationHref', () => {
  const me = { username: 'oleksandr' };

  it('сповіщення про світлину веде на неї', () => {
    expect(notificationHref({ type: 'COMMENT', photo }, me)).toBe('/photos/abc123');
  });

  it('досягнення - у свій профіль, модератор - в адмінку', () => {
    expect(notificationHref({ type: 'ACHIEVEMENT', photo: null }, me)).toBe('/users/oleksandr');
    expect(notificationHref({ type: 'MODERATOR', photo: null }, me)).toBe('/admin');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-23T12:00:00Z').getTime();

  it('хвилини, години, дні', () => {
    expect(timeAgo('2026-11-23T11:59:40Z', now)).toBe('щойно');
    expect(timeAgo('2026-11-23T11:35:00Z', now)).toBe('25 хв тому');
    expect(timeAgo('2026-11-23T09:00:00Z', now)).toBe('3 год тому');
    expect(timeAgo('2026-11-21T12:00:00Z', now)).toBe('2 дн тому');
  });
});
