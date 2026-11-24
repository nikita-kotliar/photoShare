const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const mailService = require('./mailService');
const { signToken } = require('./authService');

const TOKEN_TTL_MS = 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function resetLink(token) {
  return `${env.appUrl}/reset-password?token=${token}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function resetMail(user, link) {
  const name = user.name || user.username;
  return {
    subject: 'Відновлення пароля PhotoShare',
    text: `Вітаємо, ${name}!\n\nЩоб задати новий пароль, відкрийте посилання (діє 1 годину):\n${link}\n\nЯкщо ви не просили змінити пароль, просто проігноруйте цей лист.`,
    html: `<p>Вітаємо, ${escapeHtml(name)}!</p><p>Щоб задати новий пароль, натисніть <a href="${link}">це посилання</a>. Воно діє 1 годину.</p><p>Якщо ви не просили змінити пароль, просто проігноруйте цей лист.</p>`,
  };
}

async function requestReset({ email }) {
  if (env.isProduction && !env.mailEnabled) {
    throw new AppError(503, 'MAIL_UNAVAILABLE', 'Відновлення пароля тимчасово недоступне');
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return;

  const token = crypto.randomBytes(32).toString('hex');
  await db.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });
  await db.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  try {
    await mailService.send({ to: user.email, ...resetMail(user, resetLink(token)) });
  } catch (err) {
    console.error('Лист для відновлення пароля не надіслано:', err.message);
  }
}

function invalidToken() {
  return new AppError(422, 'VALIDATION_ERROR', 'Помилка валідації', {
    token: 'Посилання недійсне або застаріло. Попросіть новий лист',
  });
}

async function reset({ token, password }) {
  const record = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) throw invalidToken();

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) throw invalidToken();
  if (!user.isActive) throw new AppError(403, 'USER_BANNED', 'Акаунт заблоковано');

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      passwordChangedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    },
  });
  await db.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  await db.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });
  return { user: updated, token: signToken(updated) };
}

module.exports = { requestReset, reset, hashToken, escapeHtml, TOKEN_TTL_MS };
