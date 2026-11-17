import '../styles/components/confirm-dialog.css';
import { Button, setButtonLoading } from './Button.js';
import { Icon } from './icons.js';

let uid = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Модальне підтвердження дії (бан, видалення). ask() відкриває діалог і чекає:
// run() виконує дію, поки кнопка в стані завантаження, і повертає true, щоб закрити діалог.
// Проміс ask() вирішується true, якщо дію підтвердили, і false, якщо скасували
export function ConfirmDialog() {
  const id = `confirm-dialog-${++uid}`;
  const dialog = el('dialog', 'confirm-dialog');
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  dialog.setAttribute('aria-describedby', `${id}-text`);

  const close = el('button', 'confirm-dialog__close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрити');
  close.append(Icon('close', { size: '1rem' }));
  const title = el('h2', 'confirm-dialog__title');
  title.id = `${id}-title`;
  const text = el('p', 'confirm-dialog__text');
  text.id = `${id}-text`;
  const actions = el('div', 'confirm-dialog__actions');
  dialog.append(close, title, text, actions);

  let pending = null;
  let busy = false;
  close.addEventListener('click', () => dialog.close('cancel'));
  // Поки дія виконується, Escape не закриває діалог
  dialog.addEventListener('cancel', (event) => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    pending?.(dialog.returnValue === 'confirm');
    pending = null;
  });

  function ask({ title: heading, text: body, confirm = 'Підтвердити', variant = 'danger', run }) {
    title.textContent = heading;
    text.textContent = body;
    const cancel = Button({ text: 'Скасувати', variant: 'secondary', size: 'xs' });
    cancel.addEventListener('click', () => dialog.close('cancel'));
    const ok = Button({ text: confirm, variant, size: 'xs' });
    ok.addEventListener('click', async () => {
      busy = true;
      setButtonLoading(ok, true);
      cancel.disabled = true;
      close.disabled = true;
      const done = run ? await run() : true;
      busy = false;
      setButtonLoading(ok, false);
      cancel.disabled = false;
      close.disabled = false;
      if (done) dialog.close('confirm');
    });
    actions.replaceChildren(cancel, ok);
    dialog.returnValue = '';
    dialog.showModal();
    cancel.focus();
    return new Promise((resolve) => {
      pending = resolve;
    });
  }

  return Object.assign(dialog, { ask });
}
