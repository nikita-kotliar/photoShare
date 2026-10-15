const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { COOKIE_NAME } = require('../utils/cookies');

async function authenticate(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Потрібна авторизація');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'TOKEN_INVALID', 'Недійсний або прострочений токен');
  }

  const user = await db.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Користувача не знайдено');
  }
  if (!user.isActive) {
    throw new AppError(403, 'USER_BANNED', 'Акаунт заблоковано');
  }

  req.user = user;
  req.token = payload;
  next();
}

module.exports = { authenticate };
