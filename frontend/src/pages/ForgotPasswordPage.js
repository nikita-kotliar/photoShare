import '../styles/pages/auth.css';
import { authApi } from '../api/auth.js';
import { Button, setButtonLoading } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { bindForm } from '../validation/form.js';
import { schemas } from '../validation/index.js';
import { withBase } from '../router/base.js';
import { AuthShell } from './AuthPage.js';

export const SENT_TEXT =
  'Якщо акаунт з такою поштою існує, ми надіслали лист з посиланням. Воно діє 1 годину. Перевірте також «Спам».';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export default function ForgotPasswordPage() {
  const { root, form } = AuthShell('Відновлення пароля');

  const intro = el(
    'p',
    'auth__intro',
    'Вкажіть пошту акаунта, і ми надішлемо посилання, щоб задати новий пароль.',
  );
  const fields = el('div', 'auth__fields');
  fields.append(
    Input({
      label: 'Електронна пошта',
      name: 'email',
      type: 'email',
      placeholder: 'Введіть пошту',
      autocomplete: 'email',
    }),
  );
  const formError = el('p', 'auth__error');
  formError.setAttribute('role', 'alert');
  const submit = Button({ text: 'Надіслати посилання', type: 'submit' });
  submit.classList.add('auth__submit');

  const back = el('p', 'auth__switch', 'Згадали пароль? ');
  const backLink = el('a', '', 'Увійти');
  backLink.href = withBase('/auth');
  back.append(backLink);

  form.append(intro, fields, formError, submit, back);

  bindForm(form, schemas.forgot, {
    async onSubmit(values, { setErrors }) {
      formError.textContent = '';
      setButtonLoading(submit, true, 'Надсилаємо...');
      try {
        await authApi.forgotPassword(values.email);
        const done = el('p', 'auth__success', SENT_TEXT);
        done.setAttribute('role', 'status');
        form.replaceChildren(done, back);
      } catch (error) {
        if (Object.keys(error.fields ?? {}).length) setErrors(error.fields);
        else formError.textContent = error.message || 'Не вдалося надіслати лист';
      } finally {
        if (submit.isConnected) setButtonLoading(submit, false);
      }
    },
  });

  return root;
}
