import { describe, expect, it } from 'vitest';
import { COLOR_NAMES, colorName } from './Palette.js';

describe('colorName', () => {
  it('назви всіх 12 груп українською, невідома лишається як є', () => {
    expect(Object.keys(COLOR_NAMES)).toHaveLength(12);
    expect(colorName('teal')).toBe('бірюзовий');
    expect(colorName('navy')).toBe('navy');
  });
});
