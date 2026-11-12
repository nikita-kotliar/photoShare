import '../styles/pages/settings.css';
import { usersApi } from '../api/users.js';
import { Button, setButtonLoading } from '../components/Button.js';
import { Icon } from '../components/icons.js';
import { Input } from '../components/Input.js';
import { bindForm } from '../validation/form.js';
import { schemas } from '../validation/index.js';

export const BIO_MAX = 300;
const FIELDS = ['name', 'username', 'email', 'bio'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Порівнюємо так само, як сервер: пробіли обрізаються, email у нижньому регістрі
function normalize(name, value) {
  const text = String(value ?? '').trim();
  return name === 'email' ? text.toLowerCase() : text;
}

// Лише змінені поля для PUT /users/me. Порожнє «про себе» йде як "" (сервер очищає поле),
// тому тут не можна користуватися cleanValues: вона відкидає порожні необов'язкові поля
export function profileChanges(values, user) {
  const changes = {};
  for (const name of FIELDS) {
    if (values[name] === undefined) continue;
    const next = normalize(name, values[name]);
    if (next !== normalize(name, user?.[name])) changes[name] = next;
  }
  return changes;
}

// Помилки сервера: 409 і 422 з полями показуємо під полями, решту одним повідомленням
export function profileErrors(error) {
  const fields = {};
  const rest = [];
  for (const [name, text] of Object.entries(error?.fields ?? {})) {
    if (FIELDS.includes(name)) fields[name] = text;
    else rest.push(text);
  }
  if (Object.keys(fields).length || rest.length) return { fields, message: rest[0] ?? '' };
  if (error?.status === 0) return { fields, message: error.message };
  if (error?.status === 401) return { fields, message: 'Сесія завершилась, увійдіть знову' };
  if (error?.status === 422 || error?.status === 403) return { fields, message: error.message };
  return { fields, message: 'Не вдалося зберегти профіль, спробуйте ще раз' };
}

function BioField(value) {
  const field = el('div', 'field settings__bio');
  const label = el('label', 'field__label', 'Про себе');
  label.htmlFor = 'settings-bio';
  const input = el('textarea', 'settings__textarea');
  input.id = 'settings-bio';
  input.name = 'bio';
  input.rows = 4;
  input.maxLength = BIO_MAX;
  input.placeholder = 'Кілька слів про себе';
  input.value = value ?? '';
  const counter = el('p', 'settings__counter');
  counter.id = 'settings-bio-counter';
  input.setAttribute('aria-describedby', counter.id);
  const sync = () => (counter.textContent = `${input.value.length}/${BIO_MAX}`);
  input.addEventListener('input', sync);
  sync();
  field.append(label, input, counter);
  return Object.assign(field, {
    input,
    setValue(next) {
      input.value = next ?? '';
      sync();
    },
  });
}

export function ProfileForm(user, { onSave } = {}) {
  const form = el('form', 'settings__form');
  form.setAttribute('aria-labelledby', 'settings-title');

  const name = Input({ label: 'Ім’я', name: 'name', autocomplete: 'name', maxLength: 60 });
  const username = Input({
    label: 'Юзернейм',
    name: 'username',
    autocomplete: 'username',
    maxLength: 30,
  });
  const email = Input({ label: 'Email', name: 'email', type: 'email', autocomplete: 'email' });
  const bio = BioField();
  const inputs = { name, username, email, bio };

  const status = el('p', 'settings__status');
  status.setAttribute('role', 'status');
  const formError = el('p', 'settings__error');
  formError.setAttribute('role', 'alert');

  const submit = Button({ text: 'Зберегти', type: 'submit', className: 'settings__submit' });
  const reset = Button({ text: 'Скасувати', variant: 'secondary', className: 'settings__reset' });
  const actions = el('div', 'settings__actions');
  actions.append(reset, submit);

  form.append(name, username, email, bio, formError, status, actions);

  let current = user;
  function fill(next) {
    current = next;
    for (const key of FIELDS) inputs[key].setValue(next?.[key] ?? '');
    for (const key of ['name', 'username', 'email']) inputs[key].setError('');
  }
  fill(user);

  // Будь-яка зміна ховає попереднє «Збережено» і помилку форми
  form.addEventListener('input', () => {
    status.textContent = '';
    formError.textContent = '';
  });
  reset.addEventListener('click', () => {
    fill(current);
    status.textContent = '';
    formError.textContent = '';
  });

  bindForm(form, schemas.profile, {
    async onSubmit(values, { setErrors }) {
      status.textContent = '';
      formError.textContent = '';
      const changes = profileChanges({ ...values, bio: bio.input.value }, current);
      if (!Object.keys(changes).length) {
        status.textContent = 'Змін немає, нічого зберігати';
        return;
      }
      setButtonLoading(submit, true, 'Збереження…');
      reset.disabled = true;
      try {
        const saved = await onSave(changes);
        fill(saved);
        status.textContent = 'Профіль збережено';
      } catch (error) {
        const { fields, message } = profileErrors(error);
        setErrors(fields);
        formError.textContent = message;
      } finally {
        setButtonLoading(submit, false);
        reset.disabled = false;
      }
    },
  });

  return Object.assign(form, { fill, inputs });
}

export default function SettingsPage({ store }) {
  const root = el('section', 'settings container');

  const back = el('button', 'settings__back');
  back.type = 'button';
  back.append(Icon('backDesktop', { size: '1.125rem' }), el('span', '', 'Назад'));
  back.addEventListener('click', () => window.history.back());

  const title = el('h1', 'settings__title', 'Редагування профілю');
  title.id = 'settings-title';

  const user = store.get().user;
  const profileLink = el('a', 'settings__profile-link', 'Переглянути мій профіль');
  const syncLink = (u) => (profileLink.href = `/users/${u?.username ?? ''}`);
  syncLink(user);

  // usersApi.updateMe сам кладе нового користувача в store: шапка й посилання оновляться
  const form = ProfileForm(user, { onSave: (changes) => usersApi.updateMe(changes) });

  // Вихід і вхід обробляє роутер (перебудовує сторінку), тут лише оновлюємо посилання
  const unsubscribe = store.subscribe(syncLink, (s) => s.user);

  root.append(back, title, form, profileLink);
  return { el: root, destroy: unsubscribe };
}
