import { describe, expect, it, vi } from 'vitest';
import { createLogout } from './Header.js';

function setup(logout = vi.fn().mockResolvedValue()) {
  const navigate = vi.fn();
  const onError = vi.fn();
  const onBusy = vi.fn();
  const signOut = createLogout({ logout, navigate, onError, onBusy });
  return { signOut, logout, navigate, onError, onBusy };
}

describe('createLogout', () => {
  it('виходить і переходить на стартову без запису в історії', async () => {
    const { signOut, logout, navigate, onError, onBusy } = setup();
    await signOut();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    expect(onError).not.toHaveBeenCalled();
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
  });

  it('повторне натискання під час запиту не надсилає ще один', async () => {
    let finish;
    const logout = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const { signOut, navigate } = setup(logout);
    const first = signOut();
    await signOut();
    expect(logout).toHaveBeenCalledTimes(1);
    finish();
    await first;
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('при помилці лишається на сторінці і дає вийти ще раз', async () => {
    const error = new Error('Немає з’єднання');
    const logout = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce();
    const { signOut, navigate, onError } = setup(logout);
    await signOut();
    expect(onError).toHaveBeenCalledWith(error);
    expect(navigate).not.toHaveBeenCalled();
    await signOut();
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });
});
