const { cloud } = require('cloudinary');
const cloudinary = require('../src/config/cloudinary');
const cloudinaryService = require('../src/services/cloudinaryService');

const BASE = 'https://res.cloudinary.com/demo/image/upload';

describe('toCloudinary', () => {
  it('без трансформацій повертає порожній список', () => {
    expect(cloudinaryService.toCloudinary()).toEqual([]);
    expect(cloudinaryService.toCloudinary({})).toEqual([]);
    expect(cloudinaryService.toCloudinary({ angle: 0 })).toEqual([]);
  });

  it('обрізає під квадрат до повороту і ефекту', () => {
    expect(cloudinaryService.toCloudinary({ effect: 'blur', angle: 45, crop: 'square' })).toEqual([
      { aspect_ratio: '1:1', crop: 'fill', gravity: 'auto' },
      { angle: 45 },
      { effect: 'blur:300' },
    ]);
  });
});

describe('transformedUrl', () => {
  it.each([
    [{ effect: 'grayscale' }, 'e_grayscale'],
    [{ effect: 'sepia' }, 'e_sepia'],
    [{ effect: 'blur' }, 'e_blur:300'],
    [{ angle: 90 }, 'a_90'],
    [{ crop: 'square' }, 'ar_1:1,c_fill,g_auto'],
    [{ effect: 'sepia', angle: 180, crop: 'square' }, 'ar_1:1,c_fill,g_auto/a_180/e_sepia'],
  ])('%j -> %s', (transformations, path) => {
    expect(cloudinaryService.transformedUrl('photoshare/p1', transformations)).toBe(
      `${BASE}/${path}/v1/photoshare/p1`,
    );
  });

  it('без трансформацій повертає URL оригіналу без зайвих параметрів', () => {
    expect(cloudinaryService.transformedUrl('photoshare/p1', {})).toBe(`${BASE}/v1/photoshare/p1`);
  });
});

describe('uploadImage / deleteImage', () => {
  it('тести працюють з моком SDK, а не з мережею', () => {
    expect(jest.isMockFunction(cloudinary.uploader.upload_stream)).toBe(true);
    expect(jest.isMockFunction(cloudinary.uploader.destroy)).toBe(true);
    expect(cloudinary.config().cloud_name).toBe('demo');
  });

  it('вантажить буфер у папку photoshare', async () => {
    const buffer = Buffer.from('image');

    await expect(cloudinaryService.uploadImage(buffer)).resolves.toEqual({
      url: `${BASE}/photoshare/p1.png`,
      publicId: 'photoshare/p1',
    });
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      { folder: 'photoshare', resource_type: 'image' },
      expect.any(Function),
    );
    expect(cloud.files.get('photoshare/p1')).toBe(buffer);
  });

  it('передає помилку Cloudinary далі', async () => {
    cloud.failNext(new Error('Invalid API key'));

    await expect(cloudinaryService.uploadImage(Buffer.from('x'))).rejects.toThrow(
      'Invalid API key',
    );
    expect(cloud.files.size).toBe(0);
  });

  it('видаляє файл і скидає кеш CDN', async () => {
    await cloudinaryService.uploadImage(Buffer.from('x'));

    await cloudinaryService.deleteImage('photoshare/p1');

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('photoshare/p1', {
      resource_type: 'image',
      invalidate: true,
    });
    expect(cloud.files.size).toBe(0);
  });
});
