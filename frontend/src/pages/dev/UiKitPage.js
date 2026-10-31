import { Button, IconButton } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { SearchInput } from '../../components/SearchInput.js';
import { Dropdown } from '../../components/Dropdown.js';
import { Tag, TagList } from '../../components/Tag.js';
import { PhotoCard } from '../../components/PhotoCard.js';
import sample from '../../assets/images/welcome@1x.jpg';

function block(title, ...children) {
  const section = document.createElement('section');
  section.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-4)';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--space-4)';
  row.append(...children);
  section.append(heading, row);
  return section;
}

export default function UiKitPage() {
  const root = document.createElement('div');
  root.className = 'container';
  root.style.cssText =
    'display:flex;flex-direction:column;gap:var(--space-6);padding-block:var(--space-6)';

  const title = document.createElement('h1');
  title.textContent = 'UI Kit';

  const sortTrigger = IconButton({ icon: 'sort', label: 'Сортування' });
  const sort = Dropdown({
    trigger: sortTrigger,
    label: 'Сортування',
    value: 'az',
    options: [
      { value: 'az', label: 'А-Я' },
      { value: 'za', label: 'Я-А' },
      { value: 'date', label: 'Дата реєстрації' },
    ],
  });

  const menu = Dropdown({
    trigger: Button({ text: 'Профіль', variant: 'secondary' }),
    selectable: false,
    options: [
      { value: 'settings', label: 'Редагувати профіль', icon: 'pencil' },
      { value: 'logout', label: 'Вийти з акаунта', icon: 'exit' },
    ],
  });

  const tags = ['природа', 'тварини'];
  const editable = document.createElement('div');
  const renderEditable = () =>
    editable.replaceChildren(
      TagList(tags, {
        onRemove: (name) => {
          tags.splice(tags.indexOf(name), 1);
          renderEditable();
        },
      }),
    );
  renderEditable();

  const photo = {
    id: 1,
    slug: 'sample',
    url: sample,
    description: 'Захід сонця над океаном',
    tags: ['тварини', 'природа', 'ДикаТварина'],
    author: { id: 2, username: 'ivanka', name: 'Іванка', avatarUrl: null },
    averageRating: 4.5,
    ratingsCount: 120,
    commentsCount: 12,
    createdAt: '2025-02-10T20:40:00',
  };

  root.append(
    title,
    block(
      'Кнопки: primary',
      Button({ text: 'Button', size: 'xxxs' }),
      Button({ text: 'Button', size: 'xxs', arrowLeft: true }),
      Button({ text: 'Button', size: 'xs', arrowRight: true }),
      Button({ text: 'Button', size: 'xxxs', disabled: true }),
    ),
    block(
      'Кнопки: secondary і danger',
      Button({ text: 'Button', variant: 'secondary', size: 'xxxs' }),
      Button({ text: 'Button', variant: 'secondary', size: 'xxs', arrowLeft: true }),
      Button({ text: 'Button', variant: 'secondary', size: 'xxxs', disabled: true }),
      Button({ text: 'Видалити', variant: 'danger', size: 'xxs' }),
    ),
    block(
      'Кнопки-іконки',
      IconButton({ icon: 'calendar', label: 'Календар' }),
      IconButton({ icon: 'filter', label: 'Фільтри' }),
      sort,
    ),
    block(
      'Поля',
      Input({ label: "Ім'я", name: 'default' }),
      Input({ label: "Ім'я", name: 'filled', value: 'Alex' }),
      Input({ label: "Ім'я", name: 'error', value: 'Alex', error: 'Юзера не знайдено' }),
      Input({
        label: "Ім'я",
        name: 'icon',
        icon: 'eye',
        iconLabel: 'Показати',
        onIconClick() {},
      }),
    ),
    block('Пошук', SearchInput()),
    block('Меню', menu),
    block(
      'Теги',
      TagList(['Тварини', 'Природа', 'ДикаТварина']),
      Tag('посилання', { href: '#' }),
      editable,
    ),
    block(
      'Картка світлини',
      PhotoCard(photo),
      PhotoCard(photo, { user: { id: 2, role: 'USER' } }),
      PhotoCard(photo, { user: { id: 1, role: 'ADMIN' } }),
    ),
  );

  return { el: root, destroy: () => [sort, menu].forEach((d) => d.destroy()) };
}
