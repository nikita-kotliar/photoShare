const cloudinary = require('../src/config/cloudinary');
const cloudinaryService = require('../src/services/cloudinaryService');

const BASE = 'https://res.cloudinary.com/demo/image/upload';

beforeAll(() => {
  cloudinary.config({ cloud_name: 'demo' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

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
  it('вантажить буфер у папку photoshare', async () => {
    const end = jest.fn();
    const spy = jest
      .spyOn(cloudinary.uploader, 'upload_stream')
      .mockImplementation((options, cb) => {
        setImmediate(() =>
          cb(null, { secure_url: `${BASE}/v1/photoshare/abc.png`, public_id: 'photoshare/abc' }),
        );
        return { end };
      });
    const buffer = Buffer.from('image');

    await expect(cloudinaryService.uploadImage(buffer)).resolves.toEqual({
      url: `${BASE}/v1/photoshare/abc.png`,
      publicId: 'photoshare/abc',
    });
    expect(spy).toHaveBeenCalledWith(
      { folder: 'photoshare', resource_type: 'image' },
      expect.any(Function),
    );
    expect(end).toHaveBeenCalledWith(buffer);
  });

  it('передає помилку Cloudinary далі', async () => {
    jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options, cb) => {
      setImmediate(() => cb(new Error('Invalid API key')));
      return { end: jest.fn() };
    });

    await expect(cloudinaryService.uploadImage(Buffer.from('x'))).rejects.toThrow(
      'Invalid API key',
    );
  });

  it('видаляє файл і скидає кеш CDN', async () => {
    const spy = jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });

    await cloudinaryService.deleteImage('photoshare/abc');

    expect(spy).toHaveBeenCalledWith('photoshare/abc', {
      resource_type: 'image',
      invalidate: true,
    });
  });
});
