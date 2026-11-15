const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const blacklistService = require('../services/blacklistService');
const { COOKIE_NAME } = require('../utils/cookies');

async function resolveSession(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'TOKEN_INVALID', 'Недійсний або прострочений токен');
  }
  if (!payload.jti || (await blacklistService.isRevoked(payload.jti))) {
    throw new AppError(401, 'TOKEN_INVALID', 'Сесію завершено, увійдіть знову');
  }

  const user = await db.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Користувача не знайдено');
  }
  if (!user.isActive) {
    throw new AppError(403, 'USER_BANNED', 'Акаунт заблоковано');
  }
  return { user, payload };
}

async function authenticate(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Потрібна авторизація');
  }
  const { user, payload } = await resolveSession(token);
  req.user = user;
  req.token = payload;
  next();
}

// Для публічних маршрутів: з валідною сесією знаємо користувача (наприклад, для myRating),
// без неї або з недійсною сесією запит іде як від гостя, а не падає з 401
async function optionalAuthenticate(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const { user, payload } = await resolveSession(token);
      req.user = user;
      req.token = payload;
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
    }
  }
  next();
}

module.exports = { authenticate, optionalAuthenticate };
