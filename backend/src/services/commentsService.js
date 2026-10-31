const db = require('../config/db');
const AppError = require('../utils/AppError');
const { skipFor } = require('../utils/pagination');

const commentInclude = {
  author: { select: { id: true, username: true, name: true } },
};

async function ensurePhoto(photoId) {
  const photo = await db.photo.findUnique({ where: { id: photoId }, select: { id: true } });
  if (!photo) {
    throw new AppError(404, 'NOT_FOUND', 'Світлину не знайдено');
  }
}

async function findComment(id) {
  const comment = await db.comment.findUnique({ where: { id } });
  if (!comment) {
    throw new AppError(404, 'NOT_FOUND', 'Коментар не знайдено');
  }
  return comment;
}

async function listForPhoto(photoId, pagination) {
  await ensurePhoto(photoId);
  const where = { photoId };
  const [items, total] = await Promise.all([
    db.comment.findMany({
      where,
      include: commentInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: skipFor(pagination),
      take: pagination.limit,
    }),
    db.comment.count({ where }),
  ]);
  return { items, total };
}

async function create(photoId, { text }, author) {
  await ensurePhoto(photoId);
  return db.comment.create({
    data: { text, photoId, authorId: author.id },
    include: commentInclude,
  });
}

async function update(id, { text }, user) {
  const comment = await findComment(id);
  if (comment.authorId !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'Редагувати можна лише свій коментар');
  }
  return db.comment.update({ where: { id }, data: { text }, include: commentInclude });
}

async function remove(id) {
  await findComment(id);
  await db.comment.delete({ where: { id } });
}

module.exports = { listForPhoto, create, update, remove };
