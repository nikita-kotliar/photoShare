const db = require('../config/db');
const AppError = require('../utils/AppError');
const { skipFor } = require('../utils/pagination');

const DAY_MS = 24 * 60 * 60 * 1000;

function usersWhere({ q, role, registeredFrom, registeredTo }) {
  const where = {};
  if (q) {
    where.OR = ['name', 'username', 'email'].map((field) => ({
      [field]: { contains: q, mode: 'insensitive' },
    }));
  }
  if (role) where.role = role;
  if (registeredFrom || registeredTo) {
    where.createdAt = {};
    if (registeredFrom) where.createdAt.gte = new Date(registeredFrom);
    if (registeredTo) where.createdAt.lt = new Date(new Date(registeredTo).getTime() + DAY_MS);
  }
  return where;
}

async function listUsers(query) {
  const where = usersWhere(query);
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: skipFor(query),
      take: query.limit,
    }),
    db.user.count({ where }),
  ]);
  return { items, total };
}

async function setStatus(id, { isActive }, admin) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'Користувача не знайдено');
  }
  if (user.id === admin.id || user.role === 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Не можна змінювати статус адміністратора');
  }
  return db.user.update({ where: { id }, data: { isActive } });
}

module.exports = { listUsers, setStatus };
