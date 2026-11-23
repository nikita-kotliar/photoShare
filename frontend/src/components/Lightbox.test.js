import { describe, expect, it } from 'vitest';
import { counterText, stepIndex, swipeDelta } from './Lightbox.js';

describe('Lightbox', () => {
  it('гортає в межах стрічки', () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(2);
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(1, -1, 3)).toBe(0);
  });

  it('показує номер світлини', () => {
    expect(counterText(0, 12)).toBe('1 з 12');
  });

  it('свайп ліворуч - наступна, праворуч - попередня, короткий або вертикальний - нічого', () => {
    expect(swipeDelta(-80, 10)).toBe(1);
    expect(swipeDelta(80, -5)).toBe(-1);
    expect(swipeDelta(-20, 0)).toBe(0);
    expect(swipeDelta(-60, 120)).toBe(0);
  });
});
