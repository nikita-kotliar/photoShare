export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  function get() {
    return state;
  }

  function set(patch) {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
    for (const listener of [...listeners]) listener(state);
  }

  function subscribe(callback, selector = (s) => s) {
    let last = selector(state);
    const listener = (nextState) => {
      const value = selector(nextState);
      if (Object.is(value, last)) return;
      last = value;
      callback(value, nextState);
    };
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { get, set, subscribe };
}
