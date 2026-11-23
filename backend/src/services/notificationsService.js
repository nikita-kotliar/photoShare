const db = require('../config/db');
const { skipFor } = require('../utils/pagination');

const notificationInclude = {
  actor: { select: { id: true, username: true, name: true, avatarUrl: true } },
  photo: { select: { id: true, slug: true, url: true } },
};

// Створює сповіщення для userId. Про власні дії не сповіщаємо (userId === actorId).
// Помилка тут не повинна ламати саму дію (коментар уже збережено), тому лише лог
async function notify({ userId, type, actorId = null, photoId = null, data = null }) {
  if (!userId || userId === actorId) return null;
  try {
    // Prisma не приймає null для Json-поля, тому без деталей поле просто не передаємо
    return await db.notification.create({
      data: { userId, type, actorId, photoId, ...(data ? { data } : {}) },
    });
  } catch (err) {
    console.error(`Сповіщення ${type} для ${userId} не створено:`, err.message);
    return null;
  }
}

async function list(user, pagination) {
  const where = { userId: user.id };
  const [items, total] = await Promise.all([
    db.notification.findMany({
      where,
      include: notificationInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: skipFor(pagination),
      take: pagination.limit,
    }),
    db.notification.count({ where }),
  ]);
  return { items, total };
}

function unreadCount(user) {
  return db.notification.count({ where: { userId: user.id, readAt: null } });
}

// Позначає прочитаними вказані сповіщення (лише свої) або всі, якщо ids немає
async function markRead(user, { ids } = {}) {
  const where = { userId: user.id, readAt: null };
  if (ids) where.id = { in: ids };
  const { count } = await db.notification.updateMany({ where, data: { readAt: new Date() } });
  return { updated: count, unread: await unreadCount(user) };
}

module.exports = { notify, list, unreadCount, markRead };
