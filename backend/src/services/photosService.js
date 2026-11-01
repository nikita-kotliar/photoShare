const crypto = require('node:crypto');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { skipFor } = require('../utils/pagination');
const cloudinaryService = require('./cloudinaryService');

const photoInclude = {
  author: { select: { id: true, username: true, name: true } },
  _count: { select: { comments: true } },
};

function createSlug() {
  return crypto.randomBytes(9).toString('base64url');
}

function canManage(user, photo) {
  return photo.authorId === user.id || user.role === 'ADMIN';
}

async function findPhoto(where) {
  const photo = await db.photo.findUnique({ where, include: photoInclude });
  if (!photo) {
    throw new AppError(404, 'NOT_FOUND', 'Світлину не знайдено');
  }
  return photo;
}

async function findManageable(id, user) {
  const photo = await findPhoto({ id });
  if (!canManage(user, photo)) {
    throw new AppError(403, 'FORBIDDEN', 'Недостатньо прав для цієї дії');
  }
  return photo;
}

async function listFeed(pagination) {
  const [items, total] = await Promise.all([
    db.photo.findMany({
      include: photoInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: skipFor(pagination),
      take: pagination.limit,
    }),
    db.photo.count(),
  ]);
  return { items, total };
}

function getByIdOrSlug(idOrSlug) {
  return findPhoto(/^\d+$/.test(idOrSlug) ? { id: Number(idOrSlug) } : { slug: idOrSlug });
}

async function create({ file, description, transformations, author }) {
  const image = await cloudinaryService.uploadImage(file.buffer);

  try {
    return await db.photo.create({
      data: {
        slug: createSlug(),
        url: transformations
          ? cloudinaryService.transformedUrl(image.publicId, transformations)
          : image.url,
        publicId: image.publicId,
        description,
        authorId: author.id,
      },
      include: photoInclude,
    });
  } catch (err) {
    await cloudinaryService.deleteImage(image.publicId).catch(() => {});
    throw err;
  }
}

async function update(id, { description }, user) {
  await findManageable(id, user);
  return db.photo.update({ where: { id }, data: { description }, include: photoInclude });
}

async function remove(id, user) {
  const photo = await findManageable(id, user);
  await db.photo.delete({ where: { id } });
  await cloudinaryService.deleteImage(photo.publicId).catch((err) => {
    console.error(`Cloudinary: не вдалося видалити ${photo.publicId}`, err.message);
  });
}

module.exports = { findManageable, listFeed, getByIdOrSlug, create, update, remove };
