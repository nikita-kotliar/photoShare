// Клієнтська валідація форм. Модуль чистий (без DOM), тому його легко тестувати.
// Прив'язка до форм у DOM: ./form.js. Правила збігаються з docs/API.md.
//
// Правило: (value, values) => string. Порожній рядок означає "все гаразд".
// Усі правила, крім required, пропускають порожнє значення, тому необов'язкові поля працюють.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function pluralize(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const chars = (n) => `${n} ${pluralize(n, ['символ', 'символи', 'символів'])}`;

function text(value, trim) {
  const str = value == null ? '' : String(value);
  return trim ? str.trim() : str;
}

export function required(message = 'Це поле обов’язкове') {
  return (value) => (text(value, true) === '' ? message : '');
}

export function email(message = 'Введіть коректний email') {
  return (value) => {
    const str = text(value, true);
    return str === '' || EMAIL_RE.test(str) ? '' : message;
  };
}

// trim: false потрібен для паролів, де пробіл є повноцінним символом
export function minLength(n, { trim = true, message } = {}) {
  return (value) => {
    const str = text(value, trim);
    if (str === '') return '';
    return str.length >= n ? '' : (message ?? `Мінімум ${chars(n)}`);
  };
}

export function maxLength(n, { trim = true, message } = {}) {
  return (value) => {
    const str = text(value, trim);
    return str.length <= n ? '' : (message ?? `Максимум ${chars(n)}`);
  };
}

export function pattern(regexp, message = 'Некоректне значення') {
  return (value) => {
    const str = text(value, true);
    return str === '' || regexp.test(str) ? '' : message;
  };
}

// Збіг з іншим полем форми, наприклад підтвердження пароля
export function matches(otherField, message = 'Паролі не збігаються') {
  return (value, values = {}) => (text(value, false) === text(values[otherField], false) ? '' : message);
}

export function validateField(value, rules, values = {}) {
  for (const rule of rules) {
    const error = rule(value, values);
    if (error) return error;
  }
  return '';
}

// schema: { назваПоля: [правила] }. Повертає { valid, errors }, де errors: { назваПоля: повідомлення }
export function validateForm(values, schema) {
  const errors = {};
  for (const [name, rules] of Object.entries(schema)) {
    const error = validateField(values[name], rules, values);
    if (error) errors[name] = error;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

// Теги: до 5 на світлину, кожен 1-30 символів (docs/API.md). Повертає текст помилки або ''
export function validateTags(tags, { max = 5, maxLen = 30 } = {}) {
  if (tags.length > max) return `Не більше ${max} тегів`;
  if (tags.some((tag) => tag.trim().length > maxLen)) {
    return `Тег: максимум ${chars(maxLen)}`;
  }
  return '';
}

// Готові набори правил за docs/API.md
export const fieldRules = {
  username: [
    required(),
    minLength(3),
    maxLength(30),
    pattern(/^[a-zA-Z0-9_.-]+$/, 'Лише латинські літери, цифри та символи _ . -'),
  ],
  email: [required(), email()],
  password: [required(), minLength(8, { trim: false }), maxLength(72, { trim: false })],
  name: [required(), maxLength(60)],
  description: [required(), maxLength(1000)],
  comment: [required(), maxLength(1000)],
};

export const schemas = {
  // На вході правила пароля не показуємо, лише перевіряємо, що він введений
  login: { email: fieldRules.email, password: [required()] },
  register: {
    username: fieldRules.username,
    email: fieldRules.email,
    name: [maxLength(60)],
    password: fieldRules.password,
    passwordConfirm: [required(), matches('password')],
  },
  profile: { name: fieldRules.name, username: fieldRules.username, email: fieldRules.email },
  photo: { description: fieldRules.description },
  comment: { text: fieldRules.comment },
};
