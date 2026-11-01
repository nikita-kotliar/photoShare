const db = require('../config/db');
const AppError = require('../utils/AppError');
const cloudinaryService = require('./cloudinaryService');
const qrService = require('./qrService');
const { findManageable } = require('./photosService');

async function listForPhoto(photoId) {
  const photo = await db.photo.findUnique({ where: { id: photoId }, select: { id: true } });
  if (!photo) {
    throw new AppError(404, 'NOT_FOUND', 'Світлину не знайдено');
  }
  return db.transformedLink.findMany({
    where: { photoId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

async function create(photoId, { transformations }, user) {
  const photo = await findManageable(photoId, user);
  const url = cloudinaryService.transformedUrl(photo.publicId, transformations);
  const qrCode = await qrService.toDataUrl(url);

  return db.transformedLink.create({
    data: { photoId, url, qrCode, transformations },
  });
}

module.exports = { listForPhoto, create };
