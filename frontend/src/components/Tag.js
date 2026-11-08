// Тег
export function Tag(name, { href, onRemove } = {}) {
  const text = `#${String(name).replace(/^#/, '')}`;

  if (onRemove) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag tag--removable';
    button.textContent = text;
    button.setAttribute('aria-label', `Видалити тег ${text}`);
    button.addEventListener('click', () => onRemove(name));
    return button;
  }

  const el = document.createElement(href ? 'a' : 'span');
  el.className = 'tag';
  el.textContent = text;
  if (href) el.href = href;
  return el;
}

export function TagList(tags = [], options = {}) {
  const list = document.createElement('ul');
  list.className = 'tag-list';
  list.setAttribute('role', 'list');
  for (const name of tags) {
    const item = document.createElement('li');
    item.append(Tag(name, options));
    list.append(item);
  }
  return list;
}
