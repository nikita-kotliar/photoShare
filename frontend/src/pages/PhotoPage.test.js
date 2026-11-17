import { describe, expect, it } from 'vitest';
import {
  canModerateRatings,
  commentPermissions,
  deleteCommentCopy,
  deleteRatingCopy,
  errorMessage,
  formatCommentDate,
  mergeComments,
  photoPermissions,
  ratingsCountText,
  transformationsLabel,
} from './PhotoPage.js';

describe('модерація оцінок і коментарів', () => {
  it('оцінки переглядають і видаляють лише MODERATOR і ADMIN', () => {
    expect(canModerateRatings({ id: 1, role: 'MODERATOR' })).toBe(true);
    expect(canModerateRatings({ id: 1, role: 'ADMIN' })).toBe(true);
    expect(canModerateRatings({ id: 1, role: 'USER' })).toBe(false);
    expect(canModerateRatings(null)).toBe(false);
  });

  it('коментар видаляють лише MODERATOR і ADMIN, навіть не автор', () => {
    const comment = { author: { id: 3 } };
    expect(commentPermissions({ id: 3, role: 'USER' }, comment).canDelete).toBe(false);
    expect(commentPermissions({ id: 9, role: 'MODERATOR' }, comment).canDelete).toBe(true);
  });

  it('кількість оцінок з відмінюванням', () => {
    expect(ratingsCountText(1)).toBe('1 оцінка');
    expect(ratingsCountText(3)).toBe('3 оцінки');
    expect(ratingsCountText(12)).toBe('12 оцінок');
  });

  it('тексти підтвердження називають автора і оцінку', () => {
    expect(deleteCommentCopy({ author: { name: 'Марина К.' } })).toMatchObject({
      title: 'Видалити коментар?',
      text: 'Коментар користувача Марина К. буде видалено назавжди.',
    });
    const copy = deleteRatingCopy({ value: 4, user: { username: 'ivan' } });
    expect(copy.title).toBe('Видалити оцінку?');
    expect(copy.text).toContain('Оцінку 4 з 5 користувача ivan');
    expect(deleteCommentCopy({}).text).toContain('користувача');
  });
});

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

describe('права на сторінці світлини', () => {
  const photo = { id: 1, author: { id: 2 } };
  const comment = { id: 9, author: { id: 3 } };
  const user = (id, role = 'USER') => ({ id, role });

  it('коментар редагує лише автор', () => {
    expect(commentPermissions(user(3), comment).canEdit).toBe(true);
    expect(commentPermissions(user(3, 'ADMIN'), comment).canEdit).toBe(true);
    expect(commentPermissions(user(4, 'ADMIN'), comment).canEdit).toBe(false);
    expect(commentPermissions(null, comment).canEdit).toBe(false);
  });

  it('коментар видаляють лише MODERATOR і ADMIN, навіть автор-USER не може', () => {
    expect(commentPermissions(user(4, 'MODERATOR'), comment).canDelete).toBe(true);
    expect(commentPermissions(user(4, 'ADMIN'), comment).canDelete).toBe(true);
    expect(commentPermissions(user(3), comment).canDelete).toBe(false);
    expect(commentPermissions(null, comment).canDelete).toBe(false);
  });

  it('світлиною керують автор і ADMIN, коментувати може будь-хто авторизований', () => {
    expect(photoPermissions(user(2), photo)).toEqual({ canManage: true, canComment: true });
    expect(photoPermissions(user(5, 'ADMIN'), photo).canManage).toBe(true);
    expect(photoPermissions(user(5, 'MODERATOR'), photo)).toEqual({
      canManage: false,
      canComment: true,
    });
    expect(photoPermissions(null, photo)).toEqual({ canManage: false, canComment: false });
  });
});

describe('errorMessage', () => {
  it('підбирає текст за статусом', () => {
    expect(errorMessage({ status: 0, message: 'Офлайн' })).toBe('Офлайн');
    expect(errorMessage({ status: 401 })).toBe('Увійдіть, щоб виконати цю дію');
    expect(errorMessage({ status: 403, message: 'Заборонено' })).toBe('Заборонено');
    expect(errorMessage({ status: 422, fields: { text: 'Порожньо' } })).toBe('Порожньо');
    expect(errorMessage({ status: 500, message: 'stack' }, 'Збій')).toBe('Збій');
    expect(errorMessage(null, 'Збій')).toBe('Збій');
  });
});

describe('transformationsLabel', () => {
  it('описує набір трансформацій', () => {
    expect(transformationsLabel({ effect: 'sepia', angle: 90, crop: 'square' })).toBe(
      'Сепія · 90° · квадрат',
    );
    expect(transformationsLabel({ angle: 0 })).toBe('Оригінал');
    expect(transformationsLabel()).toBe('Оригінал');
  });
});

describe('mergeComments', () => {
  it('додає нову сторінку без дублікатів', () => {
    const merged = mergeComments([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]);
    expect(merged.map((c) => c.id)).toEqual([1, 2, 3]);
  });
});
