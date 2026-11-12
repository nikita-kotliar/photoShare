import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { upload, ApiError } from './client.js';
import { photoFormData } from './photos.js';
import { store } from '../store/index.js';

// Мінімальний XMLHttpRequest: тест сам вирішує, що відповість «сервер»
class FakeXhr {
  static last;
  constructor() {
    this.listeners = {};
    this.upload = { listeners: {}, addEventListener: (t, f) => (this.upload.listeners[t] = f) };
    FakeXhr.last = this;
  }
  open(method, url) {
    Object.assign(this, { method, url });
  }
  addEventListener(type, fn) {
    this.listeners[type] = fn;
  }
  send(body) {
    this.body = body;
  }
  abort() {
    this.listeners.abort?.();
  }
  respond(status, body) {
    this.status = status;
    this.responseText = body === undefined ? '' : JSON.stringify(body);
    this.listeners.load();
  }
}

describe('upload', () => {
  beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr));
  afterEach(() => vi.unstubAllGlobals());

  it('надсилає FormData, повідомляє прогрес і повертає відповідь', async () => {
    const onProgress = vi.fn();
    const data = new FormData();
    const promise = upload('/photos', data, { onProgress });
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/photos');
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.body).toBe(data);
    expect(store.get().pending).toBe(1);

    xhr.upload.listeners.progress({ lengthComputable: true, loaded: 5, total: 10 });
    expect(onProgress).toHaveBeenCalledWith(0.5);

    xhr.respond(201, { photo: { id: 1 } });
    await expect(promise).resolves.toEqual({ photo: { id: 1 } });
    expect(store.get().pending).toBe(0);
  });

  it('перетворює помилку сервера на ApiError з полями', async () => {
    const promise = upload('/photos', new FormData());
    FakeXhr.last.respond(422, {
      error: { code: 'VALIDATION_ERROR', message: 'Помилка', fields: { image: 'Не те' } },
    });
    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.fields).toEqual({ image: 'Не те' });
  });

  it('413 без тіла від проксі дає зрозуміле повідомлення', async () => {
    const promise = upload('/photos', new FormData());
    FakeXhr.last.respond(413);
    await expect(promise).rejects.toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });

  it('мережева помилка і скасування', async () => {
    const failed = upload('/photos', new FormData());
    FakeXhr.last.listeners.error();
    await expect(failed).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });

    const controller = new AbortController();
    const aborted = upload('/photos', new FormData(), { signal: controller.signal });
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.get().pending).toBe(0);
  });

  it('401 скидає користувача', async () => {
    store.set({ user: { id: 1 } });
    const promise = upload('/photos', new FormData());
    FakeXhr.last.respond(401, { error: { code: 'UNAUTHORIZED', message: 'Потрібна авторизація' } });
    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(store.get().user).toBeNull();
  });
});

describe('photoFormData', () => {
  it('кладе файл, опис, теги й трансформації JSON-рядками', () => {
    const file = new Blob(['x'], { type: 'image/png' });
    const data = photoFormData({
      file,
      description: 'Захід сонця',
      tags: ['море', 'літо'],
      transformations: { effect: 'sepia', angle: 90 },
    });
    expect(data.get('image')).toBeInstanceOf(Blob);
    expect(data.get('description')).toBe('Захід сонця');
    expect(data.get('tags')).toBe('["море","літо"]');
    expect(data.get('transformations')).toBe('{"effect":"sepia","angle":90}');
  });

  it('не надсилає порожні теги і трансформації', () => {
    const data = photoFormData({ file: new Blob(['x']), description: 'Опис' });
    expect(data.has('tags')).toBe(false);
    expect(data.has('transformations')).toBe(false);
  });
});
