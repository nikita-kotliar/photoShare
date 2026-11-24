const { Prisma } = require('@prisma/client');
const db = require('../config/db');
const { skipFor } = require('../utils/pagination');
const { photoInclude } = require('./photosService');

// % і _ у запиті користувача - звичайні символи, а не шаблони ILIKE
function likePattern(value) {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

// Середній рейтинг з тим самим округленням, що й у відповіді (ratingsService.roundAverage),
// інакше ratingMin=4 відкинув би світлину, яка показує 4.0 при справжньому 3.96
const ratingStats = Prisma.sql`
  LEFT JOIN (
    SELECT photo_id, ROUND(AVG(value)::numeric, 1) AS avg, COUNT(*) AS cnt
    FROM ratings
    GROUP BY photo_id
  ) r ON r.photo_id = p.id`;

// Умови WHERE. Індекси під них (docs/DATA_MODEL.md, міграція 20261031000000_data_model):
// q - GIN gin_trgm_ops на photos.description і tags.name; tag - UQ tags.name і
// photo_tags(tag_id, photo_id); дати - photos(created_at, id); username - UQ users.username
// і photos(author_id, created_at); ratingMin і sort=rating - ratings(photo_id, value)
function conditions({ q, tag, ratingMin, dateFrom, dateTo, username, color }) {
  const list = [];
  if (q) {
    const pattern = likePattern(q);
    // UNION, а не OR: з OR PostgreSQL не бере GIN-індекс опису і перебирає світлини
    // по одній (на 100 тис. світлин 190 мс проти 3 мс)
    list.push(Prisma.sql`p.id IN (
      SELECT id FROM photos WHERE description ILIKE ${pattern}
      UNION
      SELECT pt.photo_id FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id
      WHERE t.name ILIKE ${pattern}
    )`);
  }
  if (tag) {
    list.push(Prisma.sql`p.id IN (
      SELECT pt.photo_id FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id
      WHERE t.name = ${tag}
    )`);
  }
  // Дати за UTC, обидва дні включно, як registeredFrom/registeredTo в адмінці (D-23)
  if (dateFrom) list.push(Prisma.sql`p.created_at >= ${dateFrom}::date`);
  if (dateTo) list.push(Prisma.sql`p.created_at < ${dateTo}::date + 1`);
  if (username) {
    list.push(Prisma.sql`p.author_id = (SELECT id FROM users WHERE username = ${username})`);
  }
  if (color) list.push(Prisma.sql`${color} = ANY(p.color_families)`);
  if (ratingMin !== undefined) list.push(Prisma.sql`r.avg >= ${ratingMin}`);
  return list;
}

function whereClause(list) {
  return list.length ? Prisma.sql`WHERE ${Prisma.join(list, ' AND ')}` : Prisma.empty;
}

// Напрямок підставляється як SQL, тому лише з білого списку, а не з запиту як є
function direction(order) {
  return Prisma.raw(order === 'asc' ? 'ASC' : 'DESC');
}

// Без оцінок світлина завжди в кінці: «немає оцінок» не означає «найгірша». При однаковому
// середньому вище та, у якої більше оцінок, далі новіші
function orderClause({ sort, order }) {
  const dir = direction(order);
  return sort === 'rating'
    ? Prisma.sql`ORDER BY r.avg ${dir} NULLS LAST, r.cnt DESC NULLS LAST, p.created_at DESC, p.id DESC`
    : Prisma.sql`ORDER BY p.created_at ${dir}, p.id ${dir}`;
}

// Два запити: id світлин сторінки і загальна кількість. Агрегат оцінок приєднуємо лише тоді,
// коли він потрібен для фільтра або сортування
function buildQueries(query) {
  const where = whereClause(conditions(query));
  const filterJoin = query.ratingMin !== undefined ? ratingStats : Prisma.empty;
  const pageJoin =
    query.ratingMin !== undefined || query.sort === 'rating' ? ratingStats : Prisma.empty;

  return {
    page: Prisma.sql`
      SELECT p.id FROM photos p ${pageJoin}
      ${where}
      ${orderClause(query)}
      LIMIT ${query.limit} OFFSET ${skipFor(query)}`,
    count: Prisma.sql`SELECT COUNT(*)::int AS total FROM photos p ${filterJoin} ${where}`,
  };
}

async function searchPhotos(query) {
  const { page, count } = buildQueries(query);
  const [rows, [{ total }]] = await Promise.all([db.$queryRaw(page), db.$queryRaw(count)]);

  const ids = rows.map((row) => row.id);
  const photos = ids.length
    ? await db.photo.findMany({ where: { id: { in: ids } }, include: photoInclude })
    : [];

  // findMany не зберігає порядок з IN, відновлюємо порядок з SQL
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  return { items: ids.map((id) => byId.get(id)).filter(Boolean), total };
}

module.exports = { likePattern, buildQueries, searchPhotos };
