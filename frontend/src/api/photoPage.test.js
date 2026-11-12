import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('./client.js');
const { photosApi } = await import('./photos.js');
const { commentsApi } = await import('./comments.js');

describe('API сторінки світлини', () => {
  beforeEach(() => vi.clearAllMocks());

  it('photosApi.update надсилає опис і повертає світлину', async () => {
    api.put.mockResolvedValue({ photo: { id: 7, description: 'Нове' } });
    await expect(photosApi.update(7, { description: 'Нове' })).resolves.toEqual({
      id: 7,
      description: 'Нове',
    });
    expect(api.put).toHaveBeenCalledWith('/photos/7', { description: 'Нове' });
  });

  it('photosApi.createLink і links працюють з /photos/:id/links', async () => {
    api.post.mockResolvedValue({ link: { id: 1, qrCode: 'data:' } });
    api.get.mockResolvedValue({ items: [{ id: 1 }] });
    await expect(photosApi.createLink(7, { effect: 'sepia' })).resolves.toEqual({
      id: 1,
      qrCode: 'data:',
    });
    expect(api.post).toHaveBeenCalledWith('/photos/7/links', {
      transformations: { effect: 'sepia' },
    });
    await expect(photosApi.links(7)).resolves.toEqual([{ id: 1 }]);
    expect(api.get).toHaveBeenCalledWith('/photos/7/links');
  });

  it('commentsApi: список, створення, редагування, видалення', async () => {
    api.get.mockResolvedValue({ items: [], total: 0 });
    api.post.mockResolvedValue({ comment: { id: 3 } });
    api.put.mockResolvedValue({ comment: { id: 3, text: 'B' } });
    api.delete.mockResolvedValue(null);

    await commentsApi.list(7, { page: 1, limit: 20 });
    expect(api.get).toHaveBeenCalledWith('/photos/7/comments', { query: { page: 1, limit: 20 } });
    await expect(commentsApi.create(7, 'A')).resolves.toEqual({ id: 3 });
    expect(api.post).toHaveBeenCalledWith('/photos/7/comments', { text: 'A' });
    await expect(commentsApi.update(3, 'B')).resolves.toEqual({ id: 3, text: 'B' });
    expect(api.put).toHaveBeenCalledWith('/comments/3', { text: 'B' });
    await commentsApi.remove(3);
    expect(api.delete).toHaveBeenCalledWith('/comments/3');
  });
});
