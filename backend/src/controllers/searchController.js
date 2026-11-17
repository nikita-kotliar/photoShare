const searchService = require('../services/searchService');
const AppError = require('../utils/AppError');
const { toPage } = require('../utils/pagination');
const { withRatings } = require('./photoResponse');

const STAFF = ['MODERATOR', 'ADMIN'];

async function photos(req, res) {
  if (req.query.username !== undefined && !STAFF.includes(req.user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Фільтр за автором доступний лише модераторам');
  }
  const { items, total } = await searchService.searchPhotos(req.query);
  res.json(toPage(await withRatings(items, req.user), total, req.query));
}

module.exports = { photos };
