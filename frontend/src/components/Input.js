import { Icon } from './icons.js';

let uid = 0;

// Поле вводу
export function Input({
  label,
  name,
  type = 'text',
  value = '',
  placeholder = '',
  error = '',
  icon,
  iconLabel,
  onIconClick,
  autocomplete,
  required = false,
  maxLength,
} = {}) {
  const id = `field-${name || 'input'}-${++uid}`;
  const errorId = `${id}-error`;

  const field = document.createElement('div');
  field.className = 'field';

  if (label) {
    const labelEl = document.createElement('label');
    labelEl.className = 'field__label';
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    field.append(labelEl);
  }

  const control = document.createElement('div');
  control.className = 'field__control';

  const input = document.createElement('input');
  input.className = 'field__input';
  input.id = id;
  input.type = type;
  input.value = value;
  input.placeholder = placeholder || label || '';
  if (name) input.name = name;
  if (autocomplete) input.autocomplete = autocomplete;
  if (maxLength) input.maxLength = maxLength;
  input.required = required;
  control.append(input);

  if (icon) {
    const iconEl = Icon(icon, { size: 20 });
    if (onIconClick) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'field__icon field__icon--button';
      button.setAttribute('aria-label', iconLabel || icon);
      button.append(iconEl);
      button.addEventListener('click', () => onIconClick({ input, button }));
      control.append(button);
    } else {
      const wrap = document.createElement('span');
      wrap.className = 'field__icon';
      wrap.append(iconEl);
      control.append(wrap);
    }
  }

  const errorEl = document.createElement('p');
  errorEl.className = 'field__error';
  errorEl.id = errorId;
  errorEl.setAttribute('aria-live', 'polite');

  field.append(control, errorEl);

  const syncFilled = () => field.classList.toggle('field--filled', input.value !== '');
  input.addEventListener('input', syncFilled);
  syncFilled();

  function setError(message = '') {
    errorEl.textContent = message;
    field.classList.toggle('field--error', Boolean(message));
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorId);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  setError(error);

  input.addEventListener('input', () => {
    if (field.classList.contains('field--error')) setError('');
  });

  return Object.assign(field, {
    input,
    setError,
    getValue: () => input.value,
    setValue(next) {
      input.value = next;
      syncFilled();
    },
  });
}
