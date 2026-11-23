const db = require('../config/db');
const AppError = require('../utils/AppError');
const notificationsService = require('./notificationsService');

// Досягнення (TASK-070). Порядок - як у блоці значків у профілі
const ACHIEVEMENTS = [
  { code: 'FIRST_PHOTO', photos: 1 },
  { code: 'TEN_PHOTOS', photos: 10 },
  { code: 'COMMENTATOR', comments: 20 },
  { code: 'CRITIC', ratingsGiven: 50 },
  { code: 'FAVORITE', averageReceived: 4.5, ratingsReceived: 5 },
];

const CODES = ACHIEVEMENTS.map((a) => a.code);

// Які досягнення перевіряти після якої дії
const TRIGGERS = {
  photo: ['FIRST_PHOTO', 'TEN_PHOTOS'],
  comment: ['COMMENTATOR'],
  ratingGiven: ['CRITIC'],
  ratingReceived: ['FAVORITE'],
};

// Середня оцінка всіх світлин автора і кількість оцінок
async function receivedRatings(userId) {
  const photos = await db.photo.findMany({ where: { authorId: userId }, select: { id: true } });
  if (!photos.length) return { average: null, count: 0 };
  const groups = await db.rating.groupBy({
    by: ['photoId'],
    where: { photoId: { in: photos.map((p) => p.id) } },
    _avg: { value: true },
    _count: { _all: true },
  });
  const count = groups.reduce((sum, g) => sum + g._count._all, 0);
  const total = groups.reduce((sum, g) => sum + g._avg.value * g._count._all, 0);
  return { average: count ? total / count : null, count };
}

// Чи виконано умову. Рахуємо лише те, що потрібно для перевіряних кодів
async function isEarned(code, userId) {
  const rule = ACHIEVEMENTS.find((a) => a.code === code);
  if (rule.photos) return (await db.photo.count({ where: { authorId: userId } })) >= rule.photos;
  if (rule.comments) {
    return (await db.comment.count({ where: { authorId: userId } })) >= rule.comments;
  }
  if (rule.ratingsGiven) {
    return (await db.rating.count({ where: { userId } })) >= rule.ratingsGiven;
  }
  const { average, count } = await receivedRatings(userId);
  return count >= rule.ratingsReceived && average >= rule.averageReceived;
}

// Перевіряє досягнення після дії і видає нові. Повертає коди щойно отриманих.
// Нове досягнення - ще й сповіщення. Помилка тут не ламає саму дію (публікацію, коментар)
async function check(userId, trigger) {
  const codes = TRIGGERS[trigger] ?? [];
  if (!userId || !codes.length) return [];
  try {
    const owned = await db.userAchievement.findMany({
      where: { userId, code: { in: codes } },
      select: { code: true },
    });
    const have = new Set(owned.map((a) => a.code));
    const fresh = [];
    for (const code of codes) {
      if (have.has(code) || !(await isEarned(code, userId))) continue;
      try {
        await db.userAchievement.create({ data: { userId, code } });
      } catch (err) {
        // Паралельний запит уже видав це досягнення (UQ user_id, code)
        if (err.code === 'P2002') continue;
        throw err;
      }
      fresh.push(code);
      await notificationsService.notify({ userId, type: 'ACHIEVEMENT', data: { code } });
    }
    return fresh;
  } catch (err) {
    console.error(`Досягнення для ${userId} не перевірено:`, err.message);
    return [];
  }
}

// Усі досягнення з позначкою, які отримано (для профілю)
async function listForUsername(username) {
  const user = await db.user.findUnique({ where: { username } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Користувача не знайдено');
  const owned = await db.userAchievement.findMany({ where: { userId: user.id } });
  const byCode = new Map(owned.map((a) => [a.code, a.createdAt]));
  return CODES.map((code) => ({
    code,
    earned: byCode.has(code),
    earnedAt: byCode.get(code) ?? null,
  }));
}

module.exports = { ACHIEVEMENTS, CODES, TRIGGERS, check, listForUsername, receivedRatings };
