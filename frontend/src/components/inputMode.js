const KEYS = ['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'];
const MAX_HEIGHT_REM = 20;

export function inputModeFor(event) {
  if (event.type === 'pointerdown') return 'pointer';
  if (event.type === 'keydown' && KEYS.includes(event.key)) return 'keyboard';
  return null;
}

// Клавіатура чи миша
export function installInputMode(doc = document) {
  const root = doc.documentElement;
  function onEvent(event) {
    const mode = inputModeFor(event);
    if (mode && root.dataset.input !== mode) root.dataset.input = mode;
  }
  doc.addEventListener('pointerdown', onEvent, true);
  doc.addEventListener('keydown', onEvent, true);
  return () => {
    doc.removeEventListener('pointerdown', onEvent, true);
    doc.removeEventListener('keydown', onEvent, true);
  };
}

export function fitHeight(scrollHeight, border, max) {
  return Math.min(scrollHeight + border, max);
}

// Поле тексту росте там, де браузер не вміє field-sizing
export function installAutosize(doc = document, win = globalThis.window) {
  if (win?.CSS?.supports?.('field-sizing', 'content')) return () => {};
  function fit(textarea) {
    const style = win.getComputedStyle(textarea);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const rem = parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || 16;
    textarea.style.height = 'auto';
    const height = fitHeight(textarea.scrollHeight, border, MAX_HEIGHT_REM * rem);
    textarea.style.height = `${height}px`;
    textarea.style.overflowY = height >= MAX_HEIGHT_REM * rem ? 'auto' : 'hidden';
  }
  function onEvent(event) {
    if (event.target instanceof win.HTMLTextAreaElement) fit(event.target);
  }
  doc.addEventListener('input', onEvent);
  doc.addEventListener('focusin', onEvent);
  return () => {
    doc.removeEventListener('input', onEvent);
    doc.removeEventListener('focusin', onEvent);
  };
}
