import { Icon, listIcons } from '../../components/icons.js';

export default function IconsPage() {
  const section = document.createElement('section');
  section.className = 'container';
  section.style.paddingBlock = 'var(--space-6)';

  const names = listIcons();
  const title = document.createElement('h1');
  title.textContent = `Іконки: ${names.length}`;
  section.append(title);

  if (names.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'Спрайт порожній. Додайте символи в src/assets/icons/sprite.svg.';
    section.append(empty);
    return section;
  }

  const grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:var(--space-4);margin-top:var(--space-5)';

  for (const name of names) {
    const cell = document.createElement('div');
    cell.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:var(--space-2);font-size:var(--fs-small)';
    cell.append(Icon(name, { size: 32 }), document.createTextNode(name));
    grid.append(cell);
  }

  section.append(grid);
  return section;
}
