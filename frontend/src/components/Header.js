import { authApi } from '../api/auth.js';
import { pushToast } from '../store/index.js';
import { Dropdown } from './Dropdown.js';
import { Icon } from './icons.js';
import { navItems, profileHref } from './navigation.js';
import { SearchInput } from './SearchInput.js';
import avatarPlaceholder from '../assets/images/avatar-placeholder.svg';
import logo from '../assets/images/logo.svg';

const MENU_ID = 'header-menu';
const AVATAR_SIZE = 48;

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

function iconLink(className, href, icon, label, size) {
  const node = link(className, href);
  node.setAttribute('aria-label', label);
  node.append(Icon(icon, { size }));
  return node;
}

function Avatar(user) {
  const img = el('img', 'header__avatar');
  img.src = user.avatarUrl || avatarPlaceholder;
  img.alt = '';
  img.width = AVATAR_SIZE;
  img.height = AVATAR_SIZE;
  img.decoding = 'async';
  return img;
}

function AddPhoto(className) {
  const add = link(`header__add ${className}`, '/upload');
  add.append(el('span', '', 'Додати світлину'), el('span', 'header__plus'));
  return add;
}

// Вихід
export function createLogout({ logout, navigate, onError, onBusy = () => {} }) {
  let pending = false;
  return async function signOut() {
    if (pending) return;
    pending = true;
    onBusy(true);
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      onError(error);
    } finally {
      pending = false;
      onBusy(false);
    }
  };
}

export function Header({ store, navigate }) {
  const root = el('header', 'header');
  let path = window.location.pathname;
  let links = [];
  let dropdown = null;
  let closeMenu = () => {};

  function setPath(next) {
    path = next;
    closeMenu();
    for (const { node, item } of links) {
      if (item.isActive(path)) node.setAttribute('aria-current', 'page');
      else node.removeAttribute('aria-current');
    }
  }

  function NavList(user, listClass, linkClass) {
    const list = el('ul', listClass);
    list.setAttribute('role', 'list');
    for (const item of navItems(user)) {
      const li = el('li');
      const node = link(linkClass, item.href, item.label);
      node.dataset.label = item.label;
      links.push({ node, item });
      li.append(node);
      list.append(li);
    }
    return list;
  }

  const logout = createLogout({
    logout: () => authApi.logout(),
    navigate,
    onError: (error) => pushToast(error.message || 'Не вдалося вийти', 'error'),
    onBusy: (busy) => {
      for (const node of root.querySelectorAll('.menu__exit')) {
        node.disabled = busy;
        node.setAttribute('aria-busy', String(busy));
      }
    },
  });

  // Меню користувача на десктопі
  function UserMenu(user) {
    const box = el('div', 'header__user');
    const trigger = el('button', 'header__user-trigger');
    trigger.type = 'button';
    trigger.append(el('span', 'header__user-name', user.name || user.username));
    trigger.append(el('span', 'header__chevron'));
    dropdown = Dropdown({
      trigger,
      label: 'Меню користувача',
      selectable: false,
      options: [
        { value: 'settings', label: 'Редагувати профіль', icon: 'pencil' },
        { value: 'logout', label: 'Вийти', icon: 'exit' },
      ],
      onChange: (value) => (value === 'logout' ? logout() : navigate('/settings')),
    });
    const avatar = link('header__user-avatar', profileHref(user));
    avatar.setAttribute('aria-label', 'Мій профіль');
    avatar.append(Avatar(user));
    box.append(
      avatar,
      dropdown,
      iconLink('header__icon-link', '/settings', 'award', 'Налаштування', '1.375rem'),
    );
    return box;
  }

  // Бургер-меню
  function Menu(user) {
    const menu = el('div', 'menu');
    menu.id = MENU_ID;
    menu.hidden = true;

    const close = el('button', 'menu__close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрити меню');
    const closeBox = el('span', 'menu__close-box');
    closeBox.append(Icon('close', { size: '1rem' }));
    close.append(closeBox);
    menu.append(close);

    if (user) {
      const profile = el('div', 'menu__profile');
      const person = link('menu__person', profileHref(user));
      person.append(Avatar(user), el('span', 'menu__name', user.name || user.username));
      const exit = el('button', 'menu__icon-link menu__exit');
      exit.type = 'button';
      exit.setAttribute('aria-label', 'Вийти');
      exit.append(Icon('exit', { size: '1.125rem' }));
      exit.addEventListener('click', logout);
      profile.append(
        person,
        iconLink('menu__icon-link', '/settings', 'award', 'Налаштування', '1.125rem'),
        el('span', 'menu__spacer'),
        iconLink('menu__icon-link', '/settings', 'pencil', 'Редагувати профіль', '1.125rem'),
        exit,
      );
      const search = SearchInput({
        placeholder: 'Пошук...',
        onSearch: (q) => {
          closeMenu();
          navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
        },
      });
      search.classList.add('menu__search');
      menu.append(profile, search, AddPhoto('menu__add'));
    }

    const nav = el('nav', 'menu__nav');
    nav.setAttribute('aria-label', 'Мобільна навігація');
    nav.append(NavList(user, 'menu__list', 'menu__link'));
    menu.append(nav);

    if (!user) {
      const auth = el('div', 'menu__auth');
      const login = link('menu__login', '/auth');
      login.append(Icon('exit', { size: '1.125rem' }), el('span', '', 'Вхід'));
      const register = link('menu__register', '/auth?tab=register');
      register.append(Icon('chevrons', { size: '1.125rem' }), el('span', '', 'Зареєструватись'));
      auth.append(login, register);
      menu.append(auth);
    }
    return { menu, close };
  }

  function render(user) {
    dropdown?.destroy();
    dropdown = null;
    closeMenu();
    links = [];

    const inner = el('div', 'header__inner');

    const brand = link('header__logo', user ? '/home' : '/');
    brand.setAttribute('aria-label', 'PhotoShare, на головну');
    const image = el('img');
    image.src = logo;
    image.alt = '';
    image.width = 177;
    image.height = 38;
    brand.append(image);

    const nav = el('nav', 'header__nav');
    nav.setAttribute('aria-label', 'Основна навігація');
    nav.append(NavList(user, 'header__list', 'header__link'));

    const actions = el('div', 'header__actions');
    if (user) {
      actions.append(AddPhoto('header__add--bar'), UserMenu(user));
    } else {
      const auth = el('div', 'auth-switch');
      auth.append(
        link('auth-switch__login', '/auth', 'Увійти'),
        link('auth-switch__register', '/auth?tab=register', 'Зареєструватися'),
      );
      actions.append(auth);
    }

    const burger = el('button', 'header__burger');
    burger.type = 'button';
    burger.setAttribute('aria-label', 'Відкрити меню');
    burger.setAttribute('aria-controls', MENU_ID);
    burger.setAttribute('aria-expanded', 'false');
    burger.append(Icon('burger', { size: '1.25rem' }));
    actions.append(burger);

    const { menu, close } = Menu(user);

    function onKeydown(event) {
      if (event.key === 'Escape') {
        closeMenu();
        burger.focus();
      }
    }

    function onOutside(event) {
      if (!menu.contains(event.target) && !burger.contains(event.target)) closeMenu();
    }

    closeMenu = () => {
      menu.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('click', onOutside, true);
    };

    burger.addEventListener('click', () => {
      if (!menu.hidden) {
        closeMenu();
        return;
      }
      menu.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      document.addEventListener('keydown', onKeydown);
      document.addEventListener('click', onOutside, true);
      close.focus();
    });
    close.addEventListener('click', () => {
      closeMenu();
      burger.focus();
    });
    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });

    inner.append(brand, nav, actions);
    root.replaceChildren(inner, menu);
    setPath(path);
  }

  store.subscribe(
    () => render(store.get().user),
    (s) => s.user?.id ?? null,
  );
  render(store.get().user);

  return Object.assign(root, { setPath });
}
