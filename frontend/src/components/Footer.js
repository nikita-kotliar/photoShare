import { Icon } from './icons.js';
import { isStaff, profileHref } from './navigation.js';
import logo from '../assets/images/logo.svg';

const SOCIALS = [
  { icon: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/' },
  { icon: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/' },
  { icon: 'twitter', label: 'Twitter', href: 'https://x.com/' },
  { icon: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/' },
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(className, href, text) {
  const node = el('a', className, text);
  node.href = href;
  return node;
}

export function footerColumns(user) {
  const main = [
    { label: 'Світлини', href: '/home' },
    { label: 'Про нас', href: '/about' },
    { label: 'Додати Світлину', href: '/upload' },
  ];
  if (isStaff(user)) main.push({ label: 'Користувачі', href: '/admin' });
  return [main, [{ label: 'Мій профіль', href: profileHref(user) }]];
}

function NavColumn(items) {
  const list = el('ul', 'footer__list');
  list.setAttribute('role', 'list');
  for (const item of items) {
    const li = el('li');
    li.append(link('footer__link', item.href, item.label));
    list.append(li);
  }
  return list;
}

export function Footer({ store }) {
  const root = el('footer', 'footer');

  function render(user) {
    const inner = el('div', 'footer__inner');

    const brand = link('footer__logo', user ? '/home' : '/');
    brand.setAttribute('aria-label', 'PhotoShare, на головну');
    const image = el('img');
    image.src = logo;
    image.alt = '';
    image.width = 177;
    image.height = 38;
    image.loading = 'lazy';
    brand.append(image);

    const nav = el('nav', 'footer__nav');
    nav.setAttribute('aria-label', 'Навігація у футері');
    nav.append(...footerColumns(user).map(NavColumn));

    // Контакти
    const contacts = el('div', 'footer__contacts');
    const phones = el('div', 'footer__phones');
    const freeLine = link('footer__phone footer__phone--free', 'tel:0800502200', '0 800 502 200');
    phones.append(
      el('span', 'footer__hotline', 'Гаряча лінія'),
      freeLine,
      link('footer__phone', 'tel:+380442901683', '+38 044 290 16 83'),
    );

    const socials = el('ul', 'footer__socials');
    socials.setAttribute('role', 'list');
    for (const { icon, label, href } of SOCIALS) {
      const li = el('li');
      const social = link('footer__social', href);
      social.target = '_blank';
      social.rel = 'noopener noreferrer';
      social.setAttribute('aria-label', label);
      social.append(Icon(icon, { size: '0.875rem' }));
      li.append(social);
      socials.append(li);
    }
    contacts.append(phones, socials);

    const copyright = el(
      'p',
      'footer__copyright',
      `© ${new Date().getFullYear()} PhotoShare. All rights reserved.`,
    );

    inner.append(brand, nav, contacts, copyright);
    root.replaceChildren(inner);
  }

  store.subscribe(
    () => render(store.get().user),
    (s) => s.user?.id ?? null,
  );
  render(store.get().user);

  return root;
}
