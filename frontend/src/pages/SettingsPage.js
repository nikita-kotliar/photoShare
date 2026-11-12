import '../styles/pages/settings.css';
import { usersApi } from '../api/users.js';
import { Button, setButtonLoading } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { bindForm } from '../validation/form.js';
import { schemas } from '../validation/index.js';
import avatarPlaceholder from '../assets/images/avatar-placeholder.svg';
import cover1x from '../assets/images/auth@1x.webp';
import cover2x from '../assets/images/auth@2x.webp';

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

// Дата реєстрації як у макеті: 03/03/25
export function formatJoined(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)}`;
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

function BioField() {
  const field = el('div', 'field settings__bio');
  const input = el('textarea', 'settings__textarea');
  input.id = 'settings-bio';
  input.name = 'bio';
  input.rows = 3;
  input.maxLength = BIO_MAX;
  input.placeholder = 'Розкажіть про себе';
  input.setAttribute('aria-label', 'Про себе');
  const counter = el('p', 'settings__counter');
  counter.id = 'settings-bio-counter';
  input.setAttribute('aria-describedby', counter.id);
  const sync = () => (counter.textContent = `${input.value.length}/${BIO_MAX}`);
  input.addEventListener('input', sync);
  sync();
  field.append(input, counter);
  return Object.assign(field, {
    input,
    setValue(next) {
      input.value = next ?? '';
      sync();
    },
  });
}

function group(title, className) {
  const fieldset = el('fieldset', `settings__group ${className}`);
  fieldset.append(el('legend', 'settings__legend', title));
  return fieldset;
}

export function ProfileForm(user, { onSave } = {}) {
  const form = el('form', 'settings__form');
  form.setAttribute('aria-labelledby', 'settings-title');

  const name = Input({
    label: 'Ім’я',
    name: 'name',
    placeholder: 'Введіть ім’я',
    autocomplete: 'name',
    maxLength: 60,
  });
  const username = Input({
    label: 'UserName',
    name: 'username',
    placeholder: 'Введіть UserName',
    autocomplete: 'username',
    maxLength: 30,
  });
  const email = Input({
    label: 'Електронна пошта',
    name: 'email',
    type: 'email',
    placeholder: 'Введіть пошту',
    autocomplete: 'email',
  });
  const bio = BioField();
  const inputs = { name, username, email, bio };

  const personal = group('Особисті дані', 'settings__group--personal');
  personal.append(name, username, email);
  const extra = group('Додаткові дані', 'settings__group--extra');
  extra.append(bio);

  const status = el('p', 'settings__status');
  status.setAttribute('role', 'status');
  const formError = el('p', 'settings__error');
  formError.setAttribute('role', 'alert');

  const reset = Button({ text: 'Скинути', variant: 'secondary', className: 'settings__reset' });
  const submit = Button({
    text: 'Застосувати зміни',
    type: 'submit',
    className: 'settings__submit',
  });
  const actions = el('div', 'settings__actions');
  actions.append(reset, submit);

  form.append(personal, extra, formError, status, actions);

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

// Банер з аватаром і датою реєстрації
function ProfileCover(user) {
  const cover = el('div', 'settings__cover');
  const picture = el('picture', 'settings__banner');
  const source = el('source');
  source.type = 'image/webp';
  source.srcset = `${cover1x} 1x, ${cover2x} 2x`;
  const banner = el('img', 'settings__banner-img');
  banner.src = cover1x;
  banner.alt = '';
  banner.width = 1060;
  banner.height = 220;
  picture.append(source, banner);

  const avatar = el('img', 'settings__avatar');
  avatar.src = user?.avatarUrl || avatarPlaceholder;
  avatar.alt = user?.name ? `Аватар: ${user.name}` : 'Аватар';
  avatar.width = 108;
  avatar.height = 108;

  const joined = el('p', 'settings__joined');
  const date = formatJoined(user?.createdAt);
  if (date) {
    const time = el('time', '', date);
    time.dateTime = user.createdAt;
    joined.append('дата реєстрації ', time);
  }

  cover.append(picture, avatar, joined);
  return cover;
}

export default function SettingsPage({ store }) {
  const root = el('section', 'settings container');
  const title = el('h1', 'visually-hidden', 'Редагування профілю');
  title.id = 'settings-title';

  const user = store.get().user;
  // usersApi.updateMe сам кладе нового користувача в store: шапка оновиться
  const form = ProfileForm(user, { onSave: (changes) => usersApi.updateMe(changes) });

  root.append(title, ProfileCover(user), form);
  return root;
}
