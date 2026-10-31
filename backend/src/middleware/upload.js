const multer = require('multer');
const AppError = require('../utils/AppError');
const { detectImageType } = require('../utils/imageType');

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const multipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 10, fieldSize: 64 * 1024 },
});

function imageError(message) {
  return new AppError(422, 'VALIDATION_ERROR', 'Помилка валідації', { image: message });
}

function toAppError(err) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Файл завеликий (максимум 10 МБ)');
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
      return imageError('Додайте один файл у поле image');
    }
    return new AppError(400, 'BAD_REQUEST', 'Некоректний multipart-запит');
  }
  return err;
}

function uploadImage(field) {
  const single = multipart.single(field);

  return (req, res, next) => {
    single(req, res, (err) => {
      if (err) return next(toAppError(err));
      if (!req.file) return next(imageError('Оберіть файл зображення'));

      const mimeType = detectImageType(req.file.buffer);
      if (!mimeType) return next(imageError('Дозволені лише зображення JPEG, PNG, WEBP або GIF'));

      req.file.mimetype = mimeType;
      return next();
    });
  };
}

module.exports = { uploadImage };
