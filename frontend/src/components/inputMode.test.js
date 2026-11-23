import { describe, expect, it } from 'vitest';
import { fitHeight, inputModeFor } from './inputMode.js';

describe('inputModeFor', () => {
  it('миша і дотик - pointer, Tab і стрілки - keyboard', () => {
    expect(inputModeFor({ type: 'pointerdown' })).toBe('pointer');
    expect(inputModeFor({ type: 'keydown', key: 'Tab' })).toBe('keyboard');
    expect(inputModeFor({ type: 'keydown', key: 'ArrowLeft' })).toBe('keyboard');
  });

  it('набір тексту не перемикає режим', () => {
    expect(inputModeFor({ type: 'keydown', key: 'а' })).toBe(null);
  });
});

describe('fitHeight', () => {
  it('висота поля - за текстом, але не більша за межу', () => {
    expect(fitHeight(100, 2, 320)).toBe(102);
    expect(fitHeight(500, 2, 320)).toBe(320);
  });
});
