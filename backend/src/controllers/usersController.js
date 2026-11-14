const usersService = require('../services/usersService');
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

module.exports = { me, updateMe, getProfile, listPhotos };
