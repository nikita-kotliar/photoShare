// Прив'язка валідації до DOM-форми: помилка під полем, очищення при вводі, блокування відправки.
// Поля створюємо UI Kit-компонентами Input / PasswordField (вони самі показують помилку).
// Для звичайного <input name="..."> всередині <div class="field"> помилку додасть bindForm.
import { validateForm } from './index.js';

const ERROR_CLASS = 'field__error';
const INVALID_CLASS = 'field--error'; // той самий клас, що в UI Kit (Input)

function fieldOf(input) {
  return input.closest('.field') ?? input.parentElement;
}

// Якщо поле створене UI Kit Input, користуємося його setError (єдине місце, де вигляд помилки).
// Для звичайних <input> всередині .field працює запасний варіант з тими самими класами.
function applyError(input, message) {
  const field = fieldOf(input);
  if (typeof field.setError === 'function') {
    field.setError(message);
    return;
  }

  let error = field.querySelector(`.${ERROR_CLASS}`);
  if (!error) {
    error = document.createElement('p');
    error.className = ERROR_CLASS;
    error.id = `${input.id || input.name}-error`;
    error.setAttribute('aria-live', 'polite');
    field.append(error);
  }
  error.textContent = message;
  field.classList.toggle(INVALID_CLASS, Boolean(message));
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', error.id);
  } else {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
}

export function showFieldError(input, message) {
  applyError(input, message);
}

export function clearFieldError(input) {
  applyError(input, '');
}

function readValues(form) {
  const values = {};
  for (const element of form.elements) {
    if (!element.name || element.disabled) continue;
    if ((element.type === 'checkbox' || element.type === 'radio') && !element.checked) continue;
    values[element.name] = element.value;
  }
  return values;
}

// schema: { назваПоля: [правила] } з ./index.js. onSubmit(values) викликається лише для валідної форми.
export function bindForm(form, schema, { onSubmit } = {}) {
  form.noValidate = true; // повідомлення показуємо самі, українською, а не вбудовані браузерні

  const inputOf = (name) => form.elements.namedItem(name);

  function validate() {
    const values = readValues(form);
    const { valid, errors } = validateForm(values, schema);
    for (const name of Object.keys(schema)) {
      const input = inputOf(name);
      if (!input) continue;
      if (errors[name]) showFieldError(input, errors[name]);
      else clearFieldError(input);
    }
    if (!valid) inputOf(Object.keys(errors)[0])?.focus();
    return { valid, values, errors };
  }

  // Помилки з сервера (422 `fields`) показуємо під відповідними полями
  function setErrors(fields = {}) {
    let first = true;
    for (const [name, message] of Object.entries(fields)) {
      const input = inputOf(name);
      if (!input) continue;
      showFieldError(input, message);
      if (first) input.focus();
      first = false;
    }
  }

  form.addEventListener('input', (event) => {
    if (event.target.name in schema) clearFieldError(event.target);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { valid, values } = validate();
    if (valid && onSubmit) await onSubmit(values, { setErrors });
  });

  return { validate, setErrors };
}
