const ratingsService = require('../services/ratingsService');
const { toRating } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');

async function create(req, res) {
  const { rating, averageRating, ratingsCount } = await ratingsService.rate(
    req.params.id,
    req.body,
    req.user,
  );
  res.status(201).json({ rating: toRating(rating), averageRating, ratingsCount });
}

async function list(req, res) {
  const { items, total } = await ratingsService.listForPhoto(req.params.id, req.query);
  res.json(toPage(items.map(toRating), total, req.query));
}

async function remove(req, res) {
  await ratingsService.remove(req.params.id);
  res.status(204).end();
}

module.exports = { create, list, remove };
