import { describe, expect, it } from 'vitest';
import { MAX_TOASTS, toastDuration, visibleToasts } from './Toast.js';

describe('toastDuration', () => {
  it('помилки показуються довше за інші повідомлення', () => {
    expect(toastDuration('error')).toBeGreaterThan(toastDuration('success'));
    expect(toastDuration('info')).toBe(toastDuration('success'));
  });

  it('невідомий тип показується як info', () => {
    expect(toastDuration('warning')).toBe(toastDuration('info'));
  });
});

describe('visibleToasts', () => {
  it(`показує не більше ${MAX_TOASTS} останніх`, () => {
    const toasts = [1, 2, 3, 4, 5].map((id) => ({ id }));
    expect(visibleToasts(toasts).map((toast) => toast.id)).toEqual([3, 4, 5]);
    expect(visibleToasts(toasts.slice(0, 2))).toHaveLength(2);
  });
});
