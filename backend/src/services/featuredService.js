const db = require('../config/db');
const { photoInclude } = require('./photosService');
const { roundAverage } = require('./ratingsService');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_RATINGS = 2;

async function photoOfWeek(now = new Date()) {
  const recent = await db.photo.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - WEEK_MS) } },
    select: { id: true },
  });
  if (!recent.length) return null;

  const groups = await db.rating.groupBy({
    by: ['photoId'],
    where: { photoId: { in: recent.map((photo) => photo.id) } },
    _avg: { value: true },
    _count: { _all: true },
  });
  const best = groups
    .filter((group) => group._count._all >= MIN_RATINGS)
    .sort(
      (a, b) =>
        roundAverage(b._avg.value) - roundAverage(a._avg.value) ||
        b._count._all - a._count._all ||
        b.photoId - a.photoId,
    )[0];
  if (!best) return null;
  return db.photo.findUnique({ where: { id: best.photoId }, include: photoInclude });
}

module.exports = { photoOfWeek, MIN_RATINGS };
