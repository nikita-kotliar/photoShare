import { Input } from './Input.js';
import { Icon } from './icons.js';

// Поле пароля з перемикачем видимості. Це UI Kit Input з кнопкою-іконкою ока,
// тому вигляд і стиль помилки (Error) беруться з нього.
// Повертає той самий елемент, що й Input (.field з input, setError, getValue, setValue).
export function PasswordField({
  label = 'Пароль',
  name = 'password',
  autocomplete = 'current-password',
  ...rest
} = {}) {
  const field = Input({
    label,
    name,
    type: 'password',
    autocomplete,
    icon: 'eyeOff', // пароль приховано
    iconLabel: 'Показати пароль',
    onIconClick: ({ input, button }) => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Приховати пароль' : 'Показати пароль');
      button.replaceChildren(Icon(show ? 'eye' : 'eyeOff', { size: 20 }));
    },
    ...rest,
  });

  field.querySelector('.field__icon--button')?.setAttribute('aria-pressed', 'false');
  return field;
}