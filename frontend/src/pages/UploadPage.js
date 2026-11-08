import '../styles/pages/upload.css';
import { Button } from '../components/Button.js';
import { Icon } from '../components/icons.js';
import { Tag } from '../components/Tag.js';
import { bindForm, clearFieldError, showFieldError } from '../validation/form.js';
import { normalizeTags, schemas, validateTags } from '../validation/index.js';
import sampleWebp from '../assets/images/welcome@1x.webp';

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_TAGS = 5;

export const EFFECTS = [
  { value: '', label: 'Без фільтра', css: 'none' },
  { value: 'grayscale', label: 'Чорно-біле', css: 'grayscale(1)' },
  { value: 'sepia', label: 'Сепія', css: 'sepia(1)' },
  { value: 'blur', label: 'Розмиття', css: 'blur(3px)' },
];

const SVG_NS = 'http://www.w3.org/2000/svg';

export function validateImage(file) {
  if (!file) return 'Оберіть світлину';
  if (!IMAGE_TYPES.includes(file.type)) return 'Підходять лише JPEG, PNG, WEBP або GIF';
  if (file.size > MAX_IMAGE_SIZE) return 'Файл більший за 10 МБ';
  return '';
}

export function addTags(tags, raw) {
  const parts = String(raw ?? '')
    .split(/[\s,]+/)
    .map((part) => part.replace(/^#+/, ''));
  const next = normalizeTags([...tags, ...parts]);
  const error = validateTags(next, { max: MAX_TAGS });
  return error ? { tags, error } : { tags: next, error: '' };
}

export function transformationsPayload({ effect = '', angle = 0, crop = false } = {}) {
  const result = {};
  if (crop) result.crop = 'square';
  if (Number(angle)) result.angle = Number(angle);
  if (effect) result.effect = effect;
  return Object.keys(result).length ? result : undefined;
}

export function previewFilter(effect) {
  return EFFECTS.find((item) => item.value === effect)?.css ?? 'none';
}

export function rotationScale({ width, height, boxWidth, boxHeight, angle, cover = false }) {
  if (!width || !height || !boxWidth || !boxHeight || !angle) return 1;
  const fit = (cover ? Math.max : Math.min)(boxWidth / width, boxHeight / height);
  const w = width * fit;
  const h = height * fit;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const visibleW = Math.min(w, boxWidth);
  const visibleH = Math.min(h, boxHeight);
  const rotatedW = visibleW * cos + visibleH * sin;
  const rotatedH = visibleW * sin + visibleH * cos;
  return Math.min(1, boxWidth / rotatedW, boxHeight / rotatedH);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function placeholderIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'upload__placeholder-icon');
  svg.setAttribute('viewBox', '0 0 192 192');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<circle cx="96" cy="96" r="90" fill="none" stroke="currentColor" stroke-width="8"/>' +
    '<circle cx="96" cy="74" r="30" fill="none" stroke="currentColor" stroke-width="8"/>' +
    '<path d="M40 160c10-28 32-42 56-42s46 14 56 42" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>';
  return svg;
}

function textField({ name, placeholder, label, multiline = false, maxLength }) {
  const field = el('div', 'field upload__field');
  const control = el(multiline ? 'textarea' : 'input', 'upload__input');
  control.name = name;
  control.id = `upload-${name}`;
  control.placeholder = placeholder;
  control.setAttribute('aria-label', label);
  if (maxLength) control.maxLength = maxLength;
  if (multiline) control.rows = 2;
  field.append(control);
  return field;
}

// Зона вибору файлу
function Dropzone(state, onChange) {
  const field = el('div', 'field upload__drop-field');
  const zone = el('label', 'upload__drop');
  const input = el('input', 'visually-hidden');
  input.type = 'file';
  input.name = 'image';
  input.id = 'upload-image';
  input.accept = IMAGE_TYPES.join(',');

  const empty = el('span', 'upload__empty');
  const hint = el('span', 'upload__hint', 'Перетягніть зображення сюди');
  const pick = el('span', 'upload__pick', 'Завантажити фото');
  empty.append(placeholderIcon(), hint, pick);

  const frame = el('span', 'upload__frame');
  const preview = el('img', 'upload__preview');
  preview.alt = 'Прев’ю світлини';
  frame.append(preview);

  const change = el('span', 'upload__change');
  change.setAttribute('aria-hidden', 'true');
  change.append(Icon('pencil', { size: '1.25rem' }));

  zone.append(input, empty, frame, change);
  field.append(zone);

  let url = '';
  function setFile(file) {
    const error = validateImage(file);
    if (error) {
      showFieldError(input, error);
      return;
    }
    clearFieldError(input);
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(file);
    state.file = file;
    preview.src = url;
    zone.classList.add('upload__drop--filled');
    zone.setAttribute('aria-label', `Обрано ${file.name}. Змінити світлину`);
    onChange(url);
  }

  input.addEventListener('change', () => {
    if (input.files?.[0]) setFile(input.files[0]);
  });

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('upload__drop--over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('upload__drop--over'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('upload__drop--over');
    const file = event.dataTransfer?.files?.[0];
    if (file) setFile(file);
  });

  return Object.assign(field, {
    input,
    frame,
    preview,
    revoke: () => url && URL.revokeObjectURL(url),
  });
}

// Теги
function TagsField(state) {
  const field = el('div', 'field upload__tags-field');
  const box = el('div', 'upload__tags');
  const list = el('ul', 'upload__tag-list');
  list.setAttribute('role', 'list');
  const input = el('input', 'upload__tag-input');
  input.id = 'upload-tags';
  input.placeholder = 'Введіть тег #';
  input.setAttribute('aria-label', `Теги, до ${MAX_TAGS}. Enter або кома додає тег`);
  input.enterKeyHint = 'done';
  box.append(list, input);
  field.append(box);

  function render() {
    list.replaceChildren(
      ...state.tags.map((name) => {
        const item = el('li');
        item.append(
          Tag(name, {
            onRemove: (removed) => {
              state.tags = state.tags.filter((tag) => tag !== removed);
              clearFieldError(input);
              render();
              input.focus();
            },
          }),
        );
        return item;
      }),
    );
    const full = state.tags.length >= MAX_TAGS;
    input.disabled = full;
    input.placeholder = full ? 'Максимум 5 тегів' : 'Введіть тег #';
  }

  function commit() {
    if (!input.value.trim()) return true;
    const { tags, error } = addTags(state.tags, input.value);
    if (error) {
      showFieldError(input, error);
      return false;
    }
    clearFieldError(input);
    state.tags = tags;
    input.value = '';
    render();
    return true;
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && !input.value && state.tags.length) {
      state.tags = state.tags.slice(0, -1);
      render();
    }
  });
  input.addEventListener('input', () => clearFieldError(input));
  input.addEventListener('blur', commit);
  box.addEventListener('click', (event) => {
    if (event.target === box) input.focus();
  });

  render();
  return Object.assign(field, { input, commit });
}

// Поворот і обрізка
function AdjustBlock(state, update) {
  const block = el('fieldset', 'upload__panel upload__adjust');
  block.append(el('legend', 'visually-hidden', 'Поворот і обрізка'));

  const rotate = el('div', 'upload__control');
  const rotateHead = el('div', 'upload__control-title');
  const rotateLabel = el('label', '', 'Поворот');
  rotateLabel.htmlFor = 'upload-angle';
  const range = el('input', 'upload__range');
  range.type = 'range';
  range.id = 'upload-angle';
  range.min = '0';
  range.max = '359';
  range.step = '1';
  range.value = '0';
  const scale = el('div', 'upload__scale');
  const value = el('output', 'upload__scale-value', '0°');
  value.htmlFor = 'upload-angle';
  scale.append(el('span', '', '0°'), el('span', '', '359°'));
  rotateHead.append(rotateLabel, value);
  const syncRange = () => {
    range.style.setProperty('--fill', `${(range.value / 359) * 100}%`);
    value.textContent = `${range.value}°`;
  };
  range.addEventListener('input', () => {
    state.angle = Number(range.value);
    syncRange();
    update();
  });
  syncRange();
  rotate.append(rotateHead, range, scale);

  const crop = el('div', 'upload__control');
  const cropTitle = el('span', 'upload__control-title', 'Обрізка');
  cropTitle.id = 'upload-crop-title';
  const toggle = el('label', 'upload__switch');
  const checkbox = el('input', 'upload__switch-input');
  checkbox.type = 'checkbox';
  checkbox.setAttribute('aria-describedby', 'upload-crop-title');
  checkbox.addEventListener('change', () => {
    state.crop = checkbox.checked;
    update();
  });
  toggle.append(checkbox, el('span', 'upload__switch-track'), el('span', '', 'Квадрат 1:1'));
  crop.append(cropTitle, toggle);

  block.append(rotate, crop);
  return block;
}

// Фільтри
function EffectsBlock(state, update) {
  const block = el('fieldset', 'upload__panel upload__effects');
  block.append(el('legend', 'upload__effects-title', 'Фільтри'));
  const list = el('div', 'upload__effect-list');
  const thumbs = [];

  for (const effect of EFFECTS) {
    const option = el('label', 'upload__effect');
    const radio = el('input', 'visually-hidden');
    radio.type = 'radio';
    radio.name = 'effect';
    radio.value = effect.value;
    radio.checked = effect.value === state.effect;
    radio.addEventListener('change', () => {
      state.effect = effect.value;
      update();
    });
    const thumb = el('img', 'upload__effect-img');
    thumb.src = sampleWebp;
    thumb.alt = '';
    thumb.width = 77;
    thumb.height = 77;
    thumb.loading = 'lazy';
    thumb.style.filter = effect.css;
    thumbs.push(thumb);
    option.append(radio, thumb, el('span', 'upload__effect-name', effect.label));
    list.append(option);
  }

  block.append(list);
  return Object.assign(block, {
    setImage(src) {
      thumbs.forEach((thumb) => (thumb.src = src));
    },
  });
}

export function UploadForm({ onSubmit } = {}) {
  const state = { file: null, tags: [], effect: '', angle: 0, crop: false };
  const form = el('form', 'upload__form');
  form.setAttribute('aria-labelledby', 'upload-title');

  let effects;
  const drop = Dropzone(state, (src) => effects.setImage(src));

  function update() {
    const { preview, frame } = drop;
    preview.style.filter = previewFilter(state.effect);
    frame.classList.toggle('upload__frame--square', state.crop);
    const scale = rotationScale({
      width: preview.naturalWidth,
      height: preview.naturalHeight,
      boxWidth: frame.clientWidth,
      boxHeight: frame.clientHeight,
      angle: state.angle,
      cover: state.crop,
    });
    preview.style.transform = state.angle
      ? `rotate(${state.angle}deg) scale(${scale.toFixed(3)})`
      : '';
  }
  drop.preview.addEventListener('load', () => update());
  const onResize = () => {
    if (form.isConnected) update();
    else window.removeEventListener('resize', onResize);
  };
  window.addEventListener('resize', onResize);

  const tags = TagsField(state);
  effects = EffectsBlock(state, update);

  const fields = el('div', 'upload__fields');
  fields.append(
    textField({
      name: 'description',
      placeholder: 'Опис фото...',
      label: 'Опис світлини',
      multiline: true,
      maxLength: 1000,
    }),
    tags,
  );

  const submit = Button({ text: 'Опублікувати', type: 'submit', className: 'upload__submit' });
  const side = el('div', 'upload__side');
  side.append(fields, AdjustBlock(state, update), effects, submit);
  form.append(drop, side);

  const schema = {
    image: [() => validateImage(state.file)],
    ...schemas.photo,
  };

  const controls = bindForm(form, schema, {
    async onSubmit(values, helpers) {
      if (!tags.commit()) return;
      await onSubmit?.(
        {
          file: state.file,
          description: values.description.trim(),
          tags: state.tags,
          transformations: transformationsPayload(state),
        },
        helpers,
      );
    },
  });

  return Object.assign(form, { state, submit, setErrors: controls.setErrors, revoke: drop.revoke });
}

export default function UploadPage({ onSubmit } = {}) {
  const root = el('section', 'upload container');

  // Заголовок
  const back = el('button', 'upload__back');
  back.type = 'button';
  back.append(Icon('backDesktop', { size: '1.125rem' }), el('span', '', 'Назад'));
  back.addEventListener('click', () => window.history.back());
  const title = el('h1', 'upload__title', 'Завантаження та редагування фото');
  title.id = 'upload-title';

  root.append(back, title, UploadForm({ onSubmit }));
  return root;
}
