const photosService = require('../services/photosService');
const { toPhoto } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');

async function feed(req, res) {
  const { items, total } = await photosService.listFeed(req.query);
  res.json(toPage(items.map(toPhoto), total, req.query));
}

async function getOne(req, res) {
  const photo = await photosService.getByIdOrSlug(req.params.idOrSlug);
  res.json({ photo: toPhoto(photo) });
}

async function create(req, res) {
  const photo = await photosService.create({
    file: req.file,
    description: req.body.description,
    transformations: req.body.transformations,
    author: req.user,
  });
  res.status(201).json({ photo: toPhoto(photo) });
}

async function update(req, res) {
  const photo = await photosService.update(req.params.id, req.body, req.user);
  res.json({ photo: toPhoto(photo) });
}

async function remove(req, res) {
  await photosService.remove(req.params.id, req.user);
  res.status(204).end();
}

module.exports = { feed, getOne, create, update, remove };
