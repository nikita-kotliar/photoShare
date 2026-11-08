import '../styles/pages/welcome.css';
import { Button } from '../components/Button.js';
import logo from '../assets/images/logo-dark.svg';
import photoJpg from '../assets/images/welcome@1x.jpg';
import photo1x from '../assets/images/welcome@1x.webp';
import photo2x from '../assets/images/welcome@2x.webp';

const VALUES = ['Відкритість', 'Безпека', 'Повага до контенту', 'Якісне збереження фото'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function Block(title, ...content) {
  const block = el('section', 'welcome__block');
  block.append(el('h2', 'welcome__subtitle', title), ...content);
  return block;
}

function Photo() {
  const picture = el('picture', 'welcome__photo');
  const source = el('source');
  source.type = 'image/webp';
  source.srcset = `${photo1x} 1x, ${photo2x} 2x`;
  const img = el('img');
  img.src = photoJpg;
  img.alt = '';
  img.width = 636;
  img.height = 580;
  img.fetchPriority = 'high';
  picture.append(source, img);
  return picture;
}

export function welcomeActions(user) {
  if (user) return [{ text: 'Повернутися до світлин', href: '/home' }];
  return [
    { text: 'Увійти', href: '/auth', variant: 'secondary' },
    { text: 'Зареєструватися', href: '/auth?tab=register' },
  ];
}

export default function WelcomePage({ store }) {
  const root = el('section', 'welcome container');

  // Логотип і слоган
  const title = el('h1', 'welcome__logo');
  const image = el('img');
  image.src = logo;
  image.alt = 'PhotoShare';
  image.width = 177;
  image.height = 38;
  title.append(image);

  const tagline = el('p', 'welcome__tagline', 'Місце, де кожен кадр має значення');
  const band = el(
    'p',
    'welcome__band',
    'Ми створюємо простір для творчих людей, щоб вони могли ділитися своїми моментами та знаходити натхнення',
  );

  // Цінності і контакти
  const values = el('ul', 'welcome__values');
  values.append(...VALUES.map((value) => el('li', '', value)));

  const contacts = el('div', 'welcome__contacts');
  const mail = el('a', '', 'support@photoshare.com');
  mail.href = 'mailto:support@photoshare.com';
  const phone = el('a', '', '+380 44 290 16 83');
  phone.href = 'tel:+380442901683';
  const mailLine = el('p', 'welcome__contact');
  mailLine.append(el('span', 'welcome__emoji', '📧'), 'Електронна пошта: ', mail);
  const phoneLine = el('p', 'welcome__contact');
  phoneLine.append(el('span', 'welcome__emoji', '📞'), 'Телефон: ', phone);
  for (const emoji of [mailLine, phoneLine]) {
    emoji.firstChild.setAttribute('aria-hidden', 'true');
  }
  contacts.append(mailLine, phoneLine);

  const text = el('div', 'welcome__text');
  text.append(Block('Наші цінності', values), Block('Контакти', contacts));

  // Кнопки
  const actions = el('div', 'welcome__actions');
  actions.append(...welcomeActions(store.get().user).map((action) => Button(action)));

  root.append(title, tagline, band, text, Photo(), actions);
  return root;
}
