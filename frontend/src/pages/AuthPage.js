import '../styles/pages/auth.css';
import { authApi } from '../api/auth.js';
import { Button, setButtonLoading } from '../components/Button.js';
import { GoogleButton } from '../components/GoogleButton.js';
import { Input } from '../components/Input.js';
import { PasswordField } from '../components/PasswordField.js';
import { bindForm } from '../validation/form.js';
import { schemas } from '../validation/index.js';
import { ThemedImages } from '../components/theme.js';
import logo from '../assets/images/logo-auth.svg';
import logoLight from '../assets/images/logo.svg';
import photoJpg from '../assets/images/auth@1x.jpg';
import photoJpg2x from '../assets/images/auth@2x.jpg';
import photoWebp from '../assets/images/auth@1x.webp';
import photoWebp2x from '../assets/images/auth@2x.webp';
import tabletJpg from '../assets/images/auth-tablet@1x.jpg';
import tabletJpg2x from '../assets/images/auth-tablet@2x.jpg';
import tabletWebp from '../assets/images/auth-tablet@1x.webp';
import tabletWebp2x from '../assets/images/auth-tablet@2x.webp';
import { withBase } from '../router/base.js';

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
    submit: 'Зареєструватися',
    switchText: 'Вже маєте акаунт?',
    switchLink: 'Увійти',
  },
};

export function authMode(query = {}) {
  return query.tab === 'register' ? 'register' : 'login';
}

// Коди помилок, з якими бекенд повертає на /auth?googleError=<код> (docs/API.md)
export const GOOGLE_ERRORS = {
  cancelled: 'Вхід через Google скасовано. Спробуйте ще раз або увійдіть з паролем.',
  banned: 'Акаунт заблоковано. Зверніться до адміністратора.',
  email_unverified:
    'Пошта цього акаунта Google не підтверджена. Підтвердьте її в Google або зареєструйтеся з паролем.',
  unavailable: 'Вхід через Google зараз недоступний. Спробуйте пізніше або увійдіть з паролем.',
};

export function googleErrorMessage(code) {
  if (!code) return '';
  return GOOGLE_ERRORS[code] ?? 'Не вдалося увійти через Google. Спробуйте ще раз.';
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
    const forgot = el('a', 'auth__forgot', 'Забули пароль?');
    forgot.href = withBase('/forgot-password');
    return [email, PasswordField({ placeholder: 'Введіть пароль' }), forgot];
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

export function AuthShell(heading) {
  const root = el('section', 'auth');

  // Логотип і фото
  const brand = el('a', 'auth__logo');
  brand.href = withBase('/');
  brand.setAttribute('aria-label', 'PhotoShare, на головну');
  brand.append(...ThemedImages({ light: logo, dark: logoLight, width: 177, height: 38 }));

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

  const panel = el('div', 'auth__panel');
  const title = el('h1', 'auth__title', heading);
  title.id = 'auth-title';
  const form = el('form', 'auth__form');
  form.setAttribute('aria-labelledby', 'auth-title');
  form.noValidate = true;
  panel.append(title, form);
  root.append(brand, picture, panel);
  return { root, form };
}

export default function AuthPage({ query, navigate }) {
  const mode = authMode(query);
  const text = MODES[mode];
  const { root, form } = AuthShell(text.title);

  const fields = el('div', 'auth__fields');
  fields.append(...Fields(mode));

  const formError = el('p', 'auth__error');
  formError.setAttribute('role', 'alert');

  // Помилка, з якою Google повернув на цю сторінку. Параметр прибираємо з адреси,
  // щоб повідомлення не з'являлося знову після оновлення сторінки
  const googleError = googleErrorMessage(query.googleError);
  if (googleError) {
    formError.textContent = googleError;
    const url = new URL(window.location.href);
    url.searchParams.delete('googleError');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }

  const submit = Button({ text: text.submit, type: 'submit' });
  submit.classList.add('auth__submit');

  const google = GoogleButton({ href: authApi.googleUrl() });
  const divider = el('p', 'auth-divider', 'або');

  form.append(fields, formError, submit, divider, google);

  if (mode === 'register') {
    form.append(
      el('p', 'auth__terms', 'Натискаючи кнопку реєстрації, ви погоджуєтесь з умовами сервісу.'),
    );
  }

  const switcher = el('p', 'auth__switch', `${text.switchText} `);
  const switchLink = el('a', '', text.switchLink);
  switchLink.href = withBase(mode === 'login' ? '/auth?tab=register' : '/auth');
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

  return root;
}
