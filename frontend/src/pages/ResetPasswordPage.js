import '../styles/pages/auth.css';
import { authApi } from '../api/auth.js';
import { Button, setButtonLoading } from '../components/Button.js';
import { PasswordField } from '../components/PasswordField.js';
import { bindForm } from '../validation/form.js';
import { schemas } from '../validation/index.js';
import { withBase } from '../router/base.js';
import { pushToast } from '../store/index.js';
import { AuthShell } from './AuthPage.js';

const TOKEN_RE = /^[0-9a-f]{64}$/;

export function validResetToken(token) {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function NewLink() {
  const line = el('p', 'auth__switch', 'Посилання застаріло? ');
  const link = el('a', '', 'Надіслати нове');
  link.href = withBase('/forgot-password');
  line.append(link);
  return line;
}

export default function ResetPasswordPage({ query, navigate }) {
  const { root, form } = AuthShell('Новий пароль');
  const token = query.token;

  if (!validResetToken(token)) {
    const error = el('p', 'auth__error', 'Посилання недійсне або неповне. Попросіть новий лист.');
    error.setAttribute('role', 'alert');
    form.append(error, NewLink());
    return root;
  }

  const fields = el('div', 'auth__fields');
  fields.append(
    PasswordField({ placeholder: 'Новий пароль', autocomplete: 'new-password' }),
    PasswordField({
      label: 'Підтвердіть пароль',
      name: 'passwordConfirm',
      placeholder: 'Повторіть пароль',
      autocomplete: 'new-password',
    }),
  );
  const formError = el('p', 'auth__error');
  formError.setAttribute('role', 'alert');
  const submit = Button({ text: 'Зберегти пароль', type: 'submit' });
  submit.classList.add('auth__submit');
  form.append(fields, formError, submit, NewLink());

  bindForm(form, schemas.reset, {
    async onSubmit(values, { setErrors }) {
      formError.textContent = '';
      setButtonLoading(submit, true, 'Зберігаємо...');
      try {
        await authApi.resetPassword(token, values.password);
        pushToast('Пароль змінено', 'success');
        navigate('/home', { replace: true });
      } catch (error) {
        if (error.fields?.password) setErrors({ password: error.fields.password });
        else formError.textContent = error.fields?.token || error.message || 'Щось пішло не так';
      } finally {
        if (submit.isConnected) setButtonLoading(submit, false);
      }
    },
  });

  return root;
}
