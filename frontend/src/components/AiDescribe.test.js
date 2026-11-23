import { describe, expect, it } from 'vitest';
import { aiDescription, aiErrorMessage, mergeAiTags } from './AiDescribe.js';

describe('aiErrorMessage', () => {
  it('ліміт: текст сервера або стандартний', () => {
    expect(aiErrorMessage({ status: 429, message: 'Ліміт вичерпано до завтра' })).toBe(
      'Ліміт вичерпано до завтра',
    );
    expect(aiErrorMessage({ status: 429, message: '' })).toContain('Ліміт AI-підказок');
    expect(aiErrorMessage({ status: 400, code: 'AI_LIMIT', message: 'x' })).toBe('x');
  });

  it('AI недоступний', () => {
    expect(aiErrorMessage({ status: 503 })).toContain('AI зараз недоступний');
    expect(aiErrorMessage({ status: 500, code: 'AI_UNAVAILABLE' })).toContain('недоступний');
  });

  it('проблеми з файлом, мережа і решта', () => {
    expect(aiErrorMessage({ status: 413 })).toContain('завеликий');
    expect(aiErrorMessage({ status: 422, fields: { image: 'Дозволені лише зображення' } })).toBe(
      'Дозволені лише зображення',
    );
    expect(aiErrorMessage({ status: 0 })).toBe('Немає з’єднання з сервером');
    expect(aiErrorMessage({ status: 500 })).toBe('Не вдалося згенерувати опис. Спробуйте ще раз');
    expect(aiErrorMessage(null)).toBe('');
  });
});

describe('mergeAiTags', () => {
  it('додає теги AI до введених без дублікатів, у нижньому регістрі', () => {
    expect(mergeAiTags(['море'], ['Море', 'захід', '#небо'])).toEqual(['море', 'захід', 'небо']);
  });

  it('не більше 5 тегів, введені користувачем першими', () => {
    expect(mergeAiTags(['a', 'b', 'c', 'd'], ['e', 'f', 'g'])).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('відкидає порожні і задовгі теги', () => {
    expect(mergeAiTags([], ['', '  ', 'x'.repeat(31), 'ок'])).toEqual(['ок']);
    expect(mergeAiTags(['ліс'], undefined)).toEqual(['ліс']);
  });
});

describe('aiDescription', () => {
  it('обрізає пробіли і довжину до 1000', () => {
    expect(aiDescription('  Опис  ')).toBe('Опис');
    expect(aiDescription('я'.repeat(1200))).toHaveLength(1000);
    expect(aiDescription(undefined)).toBe('');
  });
});
