const commentsService = require('../services/commentsService');
const { toComment } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');

async function list(req, res) {
  const { items, total } = await commentsService.listForPhoto(req.params.id, req.query);
  res.json(toPage(items.map(toComment), total, req.query));
}

async function create(req, res) {
  const comment = await commentsService.create(req.params.id, req.body, req.user);
  res.status(201).json({ comment: toComment(comment) });
}

async function update(req, res) {
  const comment = await commentsService.update(req.params.id, req.body, req.user);
  res.json({ comment: toComment(comment) });
}

async function remove(req, res) {
  await commentsService.remove(req.params.id);
  res.status(204).end();
}

module.exports = { list, create, update, remove };
