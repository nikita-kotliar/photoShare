const linksService = require('../services/linksService');
const { toLink } = require('../utils/serializers');

async function list(req, res) {
  const items = await linksService.listForPhoto(req.params.id);
  res.json({ items: items.map(toLink) });
}

async function create(req, res) {
  const link = await linksService.create(req.params.id, req.body, req.user);
  res.status(201).json({ link: toLink(link) });
}

module.exports = { list, create };
