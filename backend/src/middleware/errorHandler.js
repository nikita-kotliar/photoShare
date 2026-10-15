const AppError = require('../utils/AppError');
const env = require('../config/env');

function notFound(_req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Ресурс не знайдено'));
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, fields: err.fields },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Некоректний JSON у тілі запиту' },
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Запит завеликий' },
    });
  }

  if (!env.isTest) console.error(err);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.isProduction ? 'Внутрішня помилка сервера' : err.message,
    },
  });
}

module.exports = { notFound, errorHandler };
