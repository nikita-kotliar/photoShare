export function stubPage(title, task, ctx) {
  const section = document.createElement('section');
  section.className = 'container';
  section.style.paddingBlock = 'var(--space-6)';

  const heading = document.createElement('h1');
  heading.textContent = title;

  const note = document.createElement('p');
  note.textContent = `Заглушка. Реалізація: ${task}`;

  section.append(heading, note);

  if (ctx && Object.keys(ctx.params).length > 0) {
    const params = document.createElement('p');
    params.textContent = `Параметри: ${JSON.stringify(ctx.params)}`;
    section.append(params);
  }
  return section;
}
