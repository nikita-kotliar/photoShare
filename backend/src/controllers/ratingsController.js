const ratingsService = require('../services/ratingsService');
const achievementsService = require('../services/achievementsService');
const { toRating } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');

async function create(req, res) {
  const { rating, created, averageRating, ratingsCount, photoAuthorId } = await ratingsService.rate(
    req.params.id,
    req.body,
    req.user,
  );
  // «Критик» - тому, хто оцінив (тост), «Улюбленець» - автору світлини (лише сповіщення)
  const newAchievements = await achievementsService.check(req.user.id, 'ratingGiven');
  await achievementsService.check(photoAuthorId, 'ratingReceived');
  res
    .status(created ? 201 : 200)
    .json({ rating: toRating(rating), averageRating, ratingsCount, newAchievements });
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
