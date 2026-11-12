import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/photos.js', () => ({
  photosApi: { create: vi.fn() },
  photoFormData: vi.fn((data) => ({ formData: data })),
}));

const { photosApi } = await import('../api/photos.js');
const { photoHref, progressText, publishPhoto, uploadErrors } = await import('./UploadPage.js');

describe('progressText', () => {
  it('показує відсотки, а після відправлення файлу - обробку', () => {
    expect(progressText(0)).toBe('Завантаження 0%');
    expect(progressText(0.456)).toBe('Завантаження 46%');
    expect(progressText(1)).toBe('Обробка в Cloudinary…');
  });
});

describe('photoHref', () => {
  it('веде на slug, а без нього на id', () => {
    expect(photoHref({ id: 5, slug: 'abc' })).toBe('/photos/abc');
    expect(photoHref({ id: 5 })).toBe('/photos/5');
  });
});

describe('uploadErrors', () => {
  it('422: помилки полів під полями, решта загальним повідомленням', () => {
    expect(
      uploadErrors({
        status: 422,
        message: 'Помилка валідації',
        fields: { image: 'Не зображення', tags: 'Забагато', transformations: 'Не той кут' },
      }),
    ).toEqual({
      fields: { image: 'Не зображення', tags: 'Забагато' },
      message: 'Не той кут',
    });
    expect(uploadErrors({ status: 422, message: 'Помилка валідації', fields: {} })).toEqual({
      fields: {},
      message: 'Помилка валідації',
    });
  });

  it('413 показує під полем файлу', () => {
    expect(uploadErrors({ status: 413, message: 'Файл завеликий' })).toEqual({
      fields: { image: 'Файл завеликий' },
      message: '',
    });
  });

  it('інші статуси дають загальне повідомлення', () => {
    expect(uploadErrors({ status: 0, message: 'Немає з’єднання' }).message).toBe('Немає з’єднання');
    expect(uploadErrors({ status: 401 }).message).toBe('Сесія завершилась, увійдіть знову');
    expect(uploadErrors({ status: 500, message: 'stack trace' }).message).toBe(
      'Не вдалося опублікувати світлину, спробуйте ще раз',
    );
  });
});

describe('publishPhoto', () => {
  const data = { file: {}, description: 'Опис', tags: ['море'] };
  let helpers;
  const navigate = vi.fn();
  const wait = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    helpers = {
      setErrors: vi.fn(),
      setProgress: vi.fn(),
      setFormError: vi.fn(),
      showResult: vi.fn(() => Promise.resolve()),
    };
  });

  it('після успіху показує результат Cloudinary і переходить на нову світлину', async () => {
    const photo = { id: 9, slug: 'new-photo', url: 'https://res.cloudinary.com/x.jpg' };
    photosApi.create.mockImplementation(async (_form, { onProgress }) => {
      onProgress(0.5);
      return photo;
    });
    await publishPhoto({ navigate, wait })(data, helpers);

    expect(photosApi.create).toHaveBeenCalledWith(
      { formData: data },
      expect.objectContaining({ onProgress: helpers.setProgress }),
    );
    expect(helpers.setProgress).toHaveBeenCalledWith(0.5);
    expect(helpers.showResult).toHaveBeenCalledWith(photo);
    expect(navigate).toHaveBeenCalledWith('/photos/new-photo');
  });

  it('помилку сервера показує у формі й не переходить', async () => {
    photosApi.create.mockRejectedValue({ status: 422, fields: { description: 'Порожньо' } });
    await publishPhoto({ navigate, wait })(data, helpers);
    expect(helpers.setErrors).toHaveBeenCalledWith({ description: 'Порожньо' });
    expect(helpers.setFormError).toHaveBeenCalledWith('');
    expect(helpers.showResult).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('якщо користувач пішов зі сторінки, нікуди не переходить', async () => {
    const controller = new AbortController();
    photosApi.create.mockResolvedValue({ id: 1 });
    wait.mockImplementationOnce(async () => controller.abort());
    await publishPhoto({ navigate, wait, signal: controller.signal })(data, helpers);
    expect(navigate).not.toHaveBeenCalled();
  });
});
