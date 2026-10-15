import { createStore } from './createStore.js';

export const store = createStore({
  user: null,
  authReady: false,
  pending: 0,
  toasts: [],
});

let toastId = 0;

export function pushToast(message, type = 'info') {
  const toast = { id: ++toastId, message, type };
  store.set((s) => ({ toasts: [...s.toasts, toast] }));
  return toast.id;
}

export function dismissToast(id) {
  store.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
