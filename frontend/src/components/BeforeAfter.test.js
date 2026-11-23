import { describe, expect, it } from 'vitest';
import { clampPosition } from './BeforeAfter.js';
import { compareLabel } from '../pages/PhotoPage.js';

describe('порівняння до / після', () => {
  it('положення повзунка в межах 0-100, некоректне - посередині', () => {
    expect(clampPosition('30')).toBe(30);
    expect(clampPosition(-5)).toBe(0);
    expect(clampPosition(150)).toBe(100);
    expect(clampPosition('x')).toBe(50);
  });

  it('текст кнопки залежить від стану', () => {
    expect(compareLabel(false)).toBe('Порівняти з оригіналом');
    expect(compareLabel(true)).toBe('Сховати порівняння');
  });
});
