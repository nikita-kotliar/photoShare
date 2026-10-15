const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const BCRYPT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, {
    expiresIn: `${env.JWT_EXPIRES_IN_HOURS}h`,
    jwtid: crypto.randomUUID(),
  });
}

async function register({ username, email, password, name }) {
  const [byEmail, byUsername] = await Promise.all([
    db.user.findUnique({ where: { email } }),
    db.user.findUnique({ where: { username } }),
  ]);

  const fields = {};
  if (byEmail) fields.email = 'Користувач з таким email вже існує';
  if (byUsername) fields.username = 'Цей юзернейм вже зайнятий';
  if (Object.keys(fields).length > 0) {
    throw new AppError(409, 'CONFLICT', 'Користувач вже існує', fields);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const isFirstUser = (await db.user.count()) === 0;

  const user = await db.user.create({
    data: {
      username,
      email,
      name: name ?? username,
      passwordHash,
      role: isFirstUser ? 'ADMIN' : 'USER',
    },
  });

  return { user, token: signToken(user) };
}

async function login({ email, password }) {
  const user = await db.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Невірний email або пароль');
  }
  if (!user.isActive) {
    throw new AppError(403, 'USER_BANNED', 'Акаунт заблоковано');
  }

  return { user, token: signToken(user) };
}

module.exports = { register, login, signToken };
