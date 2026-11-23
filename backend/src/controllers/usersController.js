const usersService = require('../services/usersService');
const achievementsService = require('../services/achievementsService');
const { toPublicUser, toProfile } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');
const { withRatings } = require('./photoResponse');

function me(req, res) {
  res.json({ user: toPublicUser(req.user) });
}

async function updateMe(req, res) {
  const user = await usersService.updateMe(req.user, req.body);
  res.json({ user: toPublicUser(user) });
}

async function getProfile(req, res) {
  const { user, photosCount } = await usersService.getProfile(req.params.username);
  res.json({ user: toProfile(user, photosCount) });
}

async function listPhotos(req, res) {
  const { items, total } = await usersService.listPhotos(req.params.username, req.query);
  res.json(toPage(await withRatings(items, req.user), total, req.query));
}

// Усі досягнення користувача: отримані з датою, решта з earned: false (TASK-070)
async function achievements(req, res) {
  res.json({ items: await achievementsService.listForUsername(req.params.username) });
}

module.exports = { me, updateMe, getProfile, listPhotos, achievements };
