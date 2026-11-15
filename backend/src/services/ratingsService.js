const db = require('../config/db');
const AppError = require('../utils/AppError');
const { skipFor } = require('../utils/pagination');

const ratingInclude = {
  user: { select: { id: true, username: true, name: true, avatarUrl: true } },
};

// Середнє з одним знаком після коми, як у docs/API.md; без оцінок null
function roundAverage(value) {
  return value === null || value === undefined ? null : Math.round(value * 10) / 10;
}

async function findPhoto(photoId) {
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: { id: true, authorId: true },
  });
  if (!photo) {
    throw new AppError(404, 'NOT_FOUND', 'Світлину не знайдено');
  }
  return photo;
}

function duplicate() {
  return new AppError(409, 'CONFLICT', 'Ви вже оцінили цю світлину');
}

// Рейтинг для набору світлин одним запитом: Map(photoId -> { averageRating, ratingsCount, myRating }).
// averageRating і ratingsCount рахуються агрегатом і окремо не зберігаються (docs/DATA_MODEL.md)
async function statsFor(photoIds, viewer) {
  const ids = [...new Set(photoIds)];
  const stats = new Map(
    ids.map((id) => [id, { averageRating: null, ratingsCount: 0, myRating: null }]),
  );
  if (!ids.length) return stats;

  const [groups, mine] = await Promise.all([
    db.rating.groupBy({
      by: ['photoId'],
      where: { photoId: { in: ids } },
      _avg: { value: true },
      _count: { _all: true },
    }),
    viewer
      ? db.rating.findMany({
          where: { userId: viewer.id, photoId: { in: ids } },
          select: { photoId: true, value: true },
        })
      : [],
  ]);

  for (const group of groups) {
    const item = stats.get(group.photoId);
    item.averageRating = roundAverage(group._avg.value);
    item.ratingsCount = group._count._all;
  }
  for (const rating of mine) {
    stats.get(rating.photoId).myRating = rating.value;
  }
  return stats;
}

async function rate(photoId, { value }, user) {
  const photo = await findPhoto(photoId);
  if (photo.authorId === user.id) {
    throw new AppError(403, 'FORBIDDEN', 'Не можна оцінювати власні світлини');
  }

  const existing = await db.rating.findUnique({
    where: { photoId_userId: { photoId, userId: user.id } },
    select: { id: true },
  });
  if (existing) throw duplicate();

  let rating;
  try {
    rating = await db.rating.create({
      data: { photoId, userId: user.id, value },
      include: ratingInclude,
    });
  } catch (err) {
    // Два одночасні запити: другий упирається в UQ (photo_id, user_id)
    if (err.code === 'P2002') throw duplicate();
    throw err;
  }

  const { averageRating, ratingsCount } = (await statsFor([photoId])).get(photoId);
  return { rating, averageRating, ratingsCount };
}

async function listForPhoto(photoId, pagination) {
  await findPhoto(photoId);
  const where = { photoId };
  const [items, total] = await Promise.all([
    db.rating.findMany({
      where,
      include: ratingInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: skipFor(pagination),
      take: pagination.limit,
    }),
    db.rating.count({ where }),
  ]);
  return { items, total };
}

async function remove(id) {
  const rating = await db.rating.findUnique({ where: { id }, select: { id: true } });
  if (!rating) {
    throw new AppError(404, 'NOT_FOUND', 'Оцінку не знайдено');
  }
  await db.rating.delete({ where: { id } });
}

module.exports = { roundAverage, statsFor, rate, listForPhoto, remove };
