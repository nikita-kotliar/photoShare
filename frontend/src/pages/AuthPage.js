import '../styles/pages/auth.css';
import { authApi } from '../api/auth.js';
import { Button, setButtonLoading } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { PasswordField } from '../components/PasswordField.js';
import { bindForm } from '../validation/form.js';
import { schemas } from '../validation/index.js';
import logo from '../assets/images/logo-auth.svg';
import photoJpg from '../assets/images/auth@1x.jpg';
import photoJpg2x from '../assets/images/auth@2x.jpg';
import photoWebp from '../assets/images/auth@1x.webp';
import photoWebp2x from '../assets/images/auth@2x.webp';
import tabletJpg from '../assets/images/auth-tablet@1x.jpg';
import tabletJpg2x from '../assets/images/auth-tablet@2x.jpg';
import tabletWebp from '../assets/images/auth-tablet@1x.webp';
import tabletWebp2x from '../assets/images/auth-tablet@2x.webp';

const EMPTY_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

const MODES = {
  login: {
    title: 'Вхід',
    submit: 'Увійти',
    switchText: 'Немає облікового запису?',
    switchLink: 'Зареєструватися',
  },
  register: {
    title: 'Реєстрація',
    submit: 'Зареєструватись',
    switchText: 'Вже маєте акаунт?',
    switchLink: 'Увійти',
  },
};

export function authMode(query = {}) {
  return query.tab === 'register' ? 'register' : 'login';
}

export function registerPayload({ username, email, password, name }) {
  return name ? { username, email, password, name } : { username, email, password };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function Fields(mode) {
  const email = Input({
    label: 'Електронна пошта',
    name: 'email',
    type: 'email',
    placeholder: 'Введіть пошту',
    autocomplete: 'email',
  });
  if (mode === 'login') {
    return [email, PasswordField({ placeholder: 'Введіть пароль' })];
  }
  return [
    Input({ label: 'Ім’я', name: 'name', placeholder: 'Введіть ім’я', autocomplete: 'name' }),
    Input({
      label: 'UserName',
      name: 'username',
      placeholder: 'Введіть UserName',
      autocomplete: 'username',
    }),
    email,
    PasswordField({ placeholder: 'Введіть пароль', autocomplete: 'new-password' }),
    PasswordField({
      label: 'Підтвердіть пароль',
      name: 'passwordConfirm',
      placeholder: 'Повторіть пароль',
      autocomplete: 'new-password',
    }),
  ];
}

export default function AuthPage({ query, navigate }) {
  const mode = authMode(query);
  const text = MODES[mode];
  const root = el('section', 'auth');

  // Логотип і фото
  const brand = el('a', 'auth__logo');
  brand.href = '/';
  brand.setAttribute('aria-label', 'PhotoShare, на головну');
  const logoImg = el('img');
  logoImg.src = logo;
  logoImg.alt = '';
  logoImg.width = 177;
  logoImg.height = 38;
  brand.append(logoImg);

  const picture = el('picture', 'auth__photo');
  const source = (srcset, media, type) => {
    const node = el('source');
    node.srcset = srcset;
    if (media) node.media = media;
    if (type) node.type = type;
    return node;
  };
  const tablet = '(max-width: 1439px)';
  const img = el('img');
  img.src = photoJpg;
  img.srcset = `${photoJpg} 1x, ${photoJpg2x} 2x`;
  img.alt = '';
  img.width = 575;
  img.height = 600;
  img.fetchPriority = 'high';
  picture.append(
    source(EMPTY_IMAGE, '(max-width: 767px)'),
    source(`${tabletWebp} 1x, ${tabletWebp2x} 2x`, tablet, 'image/webp'),
    source(`${tabletJpg} 1x, ${tabletJpg2x} 2x`, tablet),
    source(`${photoWebp} 1x, ${photoWebp2x} 2x`, '', 'image/webp'),
    img,
  );

  // Форма
  const panel = el('div', 'auth__panel');
  const title = el('h1', 'auth__title', text.title);
  const form = el('form', 'auth__form');
  form.setAttribute('aria-labelledby', 'auth-title');
  title.id = 'auth-title';

  const fields = el('div', 'auth__fields');
  fields.append(...Fields(mode));

  const formError = el('p', 'auth__error');
  formError.setAttribute('role', 'alert');

  const submit = Button({ text: text.submit, type: 'submit' });
  submit.classList.add('auth__submit');

  form.append(fields, formError, submit);

  if (mode === 'register') {
    form.append(
      el('p', 'auth__terms', 'Натискаючи кнопку реєстрації, ви погоджуєтесь з умовами сервісу.'),
    );
  }

  const switcher = el('p', 'auth__switch', `${text.switchText} `);
  const switchLink = el('a', '', text.switchLink);
  switchLink.href = mode === 'login' ? '/auth?tab=register' : '/auth';
  switcher.append(switchLink);
  form.append(switcher);

  bindForm(form, schemas[mode], {
    async onSubmit(values, { setErrors }) {
      formError.textContent = '';
      setButtonLoading(submit, true, mode === 'login' ? 'Входимо...' : 'Реєструємо...');
      try {
        if (mode === 'login') {
          await authApi.login({ email: values.email, password: values.password });
        } else {
          await authApi.register(registerPayload(values));
        }
        navigate('/home', { replace: true });
      } catch (error) {
        if (Object.keys(error.fields ?? {}).length) setErrors(error.fields);
        else formError.textContent = error.message || 'Щось пішло не так';
      } finally {
        if (submit.isConnected) setButtonLoading(submit, false);
      }
    },
  });

  panel.append(title, form);
  root.append(brand, picture, panel);
  return root;
}
