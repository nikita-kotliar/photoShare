import { describe, expect, it } from 'vitest';
import {
  addTags,
  MAX_IMAGE_SIZE,
  previewFilter,
  rotationScale,
  transformationsPayload,
  validateImage,
} from './UploadPage.js';

const file = (type, size = 1024) => ({ type, size, name: 'photo' });

describe('validateImage', () => {
  it('вимагає файл', () => {
    expect(validateImage(null)).toBe('Оберіть світлину');
  });

  it('приймає JPEG, PNG, WEBP і GIF до 10 МБ', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(validateImage(file(type, MAX_IMAGE_SIZE))).toBe('');
    }
  });

  it('відхиляє інший тип і завеликий файл', () => {
    expect(validateImage(file('image/svg+xml'))).toBe('Підходять лише JPEG, PNG, WEBP або GIF');
    expect(validateImage(file('application/pdf'))).not.toBe('');
    expect(validateImage(file('image/png', MAX_IMAGE_SIZE + 1))).toBe('Файл більший за 10 МБ');
  });
});

describe('addTags', () => {
  it('нормалізує, прибирає # і дублікати', () => {
    expect(addTags(['море'], ' #Захід,  море #НЕБО ')).toEqual({
      tags: ['море', 'захід', 'небо'],
      error: '',
    });
  });

  it('не дає додати шостий тег', () => {
    const tags = ['a', 'b', 'c', 'd', 'e'];
    expect(addTags(tags, 'f')).toEqual({ tags, error: 'Не більше 5 тегів' });
    expect(addTags(tags, 'a').error).toBe('');
  });

  it('не приймає тег довший за 30 символів', () => {
    const result = addTags([], 'x'.repeat(31));
    expect(result.tags).toEqual([]);
    expect(result.error).toBe('Тег: максимум 30 символів');
  });
});

describe('transformationsPayload', () => {
  it('без змін нічого не передає', () => {
    expect(transformationsPayload({ effect: '', angle: 0, crop: false })).toBeUndefined();
    expect(transformationsPayload()).toBeUndefined();
  });

  it('передає лише обрані трансформації', () => {
    expect(transformationsPayload({ effect: 'sepia', angle: 90, crop: true })).toEqual({
      crop: 'square',
      angle: 90,
      effect: 'sepia',
    });
    expect(transformationsPayload({ angle: '45' })).toEqual({ angle: 45 });
  });
});

describe('rotationScale', () => {
  const box = { boxWidth: 400, boxHeight: 400 };

  it('без повороту не змінює розмір', () => {
    expect(rotationScale({ width: 800, height: 400, ...box, angle: 0 })).toBe(1);
    expect(rotationScale({ width: 0, height: 0, ...box, angle: 45 })).toBe(1);
  });

  it('зменшує повернуте фото, щоб воно вміщалося в рамку', () => {
    expect(rotationScale({ width: 400, height: 400, ...box, angle: 45 })).toBeCloseTo(
      1 / Math.SQRT2,
    );
    expect(rotationScale({ width: 800, height: 400, ...box, angle: 90 })).toBeCloseTo(1);
    expect(rotationScale({ width: 800, height: 400, ...box, angle: 180 })).toBeCloseTo(1);
  });

  it('для квадратної обрізки рахує від усієї рамки', () => {
    expect(rotationScale({ width: 800, height: 400, ...box, angle: 45, cover: true })).toBeCloseTo(
      1 / Math.SQRT2,
    );
  });
});

describe('previewFilter', () => {
  it('дає CSS-фільтр для прев’ю', () => {
    expect(previewFilter('grayscale')).toBe('grayscale(1)');
    expect(previewFilter('')).toBe('none');
    expect(previewFilter('unknown')).toBe('none');
  });
});
