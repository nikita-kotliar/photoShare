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

// name: за замовчуванням А-Я, date: нові першими. id в кінці, щоб сторінки не перетиналися
function usersOrder({ sort, order }) {
  if (sort === 'name') {
    const dir = order ?? 'asc';
    return [{ name: dir }, { username: dir }, { id: dir }];
  }
  const dir = order ?? 'desc';
  return [{ createdAt: dir }, { id: dir }];
}

async function listUsers(query) {
  const where = usersWhere(query);
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: usersOrder(query),
      skip: skipFor(query),
      take: query.limit,
    }),
    db.user.count({ where }),
  ]);
  return { items, total };
}

async function editableUser(id, admin, message) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'Користувача не знайдено');
  }
  if (user.id === admin.id || user.role === 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', message);
  }
  return user;
}

async function setStatus(id, { isActive }, admin) {
  await editableUser(id, admin, 'Не можна змінювати статус адміністратора');
  return db.user.update({ where: { id }, data: { isActive } });
}

async function setRole(id, { role }, admin) {
  await editableUser(id, admin, 'Не можна змінювати роль адміністратора');
  return db.user.update({ where: { id }, data: { role } });
}

module.exports = { listUsers, setStatus, setRole };
