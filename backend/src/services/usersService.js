const db = require('../config/db');
const AppError = require('../utils/AppError');
const photosService = require('./photosService');

async function getByUsername(username) {
  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'Користувача не знайдено');
  }
  return user;
}

async function getProfile(username) {
  const user = await getByUsername(username);
  const photosCount = await db.photo.count({ where: { authorId: user.id } });
  return { user, photosCount };
}

async function listPhotos(username, pagination) {
  const user = await getByUsername(username);
  return photosService.listFeed(pagination, { authorId: user.id });
}

function conflict(fields) {
  return new AppError(409, 'CONFLICT', 'Користувач вже існує', fields);
}

// Змінюємо лише поля, які передали і які справді відрізняються від поточних
async function updateMe(current, { name, username, email }) {
  const fields = {};

  if (username !== undefined && username !== current.username) {
    if (await db.user.findUnique({ where: { username } })) {
      fields.username = 'Цей юзернейм вже зайнятий';
    }
  }
  if (email !== undefined && email !== current.email) {
    if (await db.user.findUnique({ where: { email } })) {
      fields.email = 'Користувач з таким email вже існує';
    }
  }
  if (Object.keys(fields).length > 0) throw conflict(fields);

  try {
    return await db.user.update({
      where: { id: current.id },
      data: { name, username, email },
    });
  } catch (err) {
    // Гонка: хтось встиг зайняти значення між перевіркою і записом
    if (err.code === 'P2002') {
      const target = [err.meta?.target].flat().join(',');
      throw conflict(
        target.includes('email')
          ? { email: 'Користувач з таким email вже існує' }
          : { username: 'Цей юзернейм вже зайнятий' },
      );
    }
    throw err;
  }
}

module.exports = { getProfile, listPhotos, updateMe };
