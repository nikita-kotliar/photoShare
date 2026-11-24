import { describe, expect, it } from 'vitest';
import { validResetToken } from './ResetPasswordPage.js';

describe('validResetToken', () => {
  it('лише 64 шістнадцяткові символи', () => {
    expect(validResetToken('a'.repeat(64))).toBe(true);
    expect(validResetToken('A'.repeat(64))).toBe(false);
    expect(validResetToken('a'.repeat(63))).toBe(false);
    expect(validResetToken(undefined)).toBe(false);
  });
});
