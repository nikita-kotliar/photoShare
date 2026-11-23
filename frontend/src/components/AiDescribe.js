import '../styles/components/ai-describe.css';
import { normalizeTags } from '../validation/index.js';
import { setButtonLoading } from './Button.js';

export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 30;
export const MAX_DESCRIPTION = 1000;

// ====== Чисті функції (покриті тестами) ======

// Повідомлення для помилок POST /api/ai/describe
export function aiErrorMessage(error) {
  if (!error) return '';
  if (error.status === 429 || error.code === 'AI_LIMIT') {
    return error.message || 'Ліміт AI-підказок на сьогодні вичерпано. Заповніть опис і теги вручну';
  }
  if (error.status === 503 || error.code === 'AI_UNAVAILABLE') {
    return 'AI зараз недоступний. Спробуйте пізніше або заповніть поля вручну';
  }
  if (error.status === 413) return 'Файл завеликий для AI-підказки (максимум 10 МБ)';
  if (error.status === 422)
    return error.fields?.image || error.message || 'Це зображення не підходить';
  if (error.status === 0) return 'Немає з’єднання з сервером';
  return 'Не вдалося згенерувати опис. Спробуйте ще раз';
}

// Теги від AI додаються до вже введених: без дублікатів, не довші за 30 символів, до 5
export function mergeAiTags(current, suggested = []) {
  const clean = suggested
    .map((tag) => String(tag).replace(/^#+/, ''))
    .filter((tag) => tag.trim() && tag.trim().length <= MAX_TAG_LENGTH);
  return normalizeTags([...current, ...clean]).slice(0, MAX_TAGS);
}

export function aiDescription(text) {
  return String(text ?? '')
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

// ====== Компонент ======

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Кнопка «Згенерувати опис і теги»: надсилає обрану світлину на AI і віддає результат
// в onResult({ description, tags }). Поля лишаються редагованими
export function AiDescribe({ getFile, describe, onResult, onUndo } = {}) {
  const box = el('div', 'ai-describe');
  const button = el('button', 'ai-describe__button');
  button.type = 'button';
  const label = el('span', 'btn__text', 'Згенерувати опис і теги');
  button.append(el('span', 'ai-describe__spark', '✨'), label);
  const status = el('p', 'ai-describe__status');
  status.setAttribute('aria-live', 'polite');
  const undo = el('button', 'ai-describe__undo', 'Повернути мій опис');
  undo.type = 'button';
  undo.hidden = true;
  box.append(button, status, undo);

  let controller = null;

  function setStatus(text, kind = '') {
    status.textContent = text;
    status.className = `ai-describe__status${kind ? ` ai-describe__status--${kind}` : ''}`;
  }

  function setReady(ready) {
    button.disabled = !ready;
    if (!ready) setStatus('Спершу оберіть світлину, і AI запропонує опис і теги');
    else if (!controller) setStatus('');
  }

  function abort() {
    controller?.abort();
    controller = null;
    setButtonLoading(button, false);
  }

  button.addEventListener('click', async () => {
    const file = getFile();
    if (!file) return setReady(false);
    abort();
    controller = new AbortController();
    const { signal } = controller;
    setButtonLoading(button, true, 'AI аналізує світлину…');
    setStatus('Це займає кілька секунд');
    undo.hidden = true;
    try {
      const result = await describe(file, { signal });
      if (signal.aborted) return;
      const hadText = onResult({
        description: aiDescription(result.description),
        tags: Array.isArray(result.tags) ? result.tags : [],
      });
      undo.hidden = !hadText;
      setStatus('Готово! Перевірте й відредагуйте текст, якщо потрібно', 'success');
    } catch (error) {
      if (error.name === 'AbortError' || signal.aborted) return;
      setStatus(aiErrorMessage(error), 'error');
    } finally {
      if (!signal.aborted) {
        controller = null;
        setButtonLoading(button, false);
      }
    }
  });

  undo.addEventListener('click', () => {
    onUndo?.();
    undo.hidden = true;
    setStatus('Повернуто ваш опис');
  });

  setReady(false);
  return Object.assign(box, { setReady, abort, button });
}
