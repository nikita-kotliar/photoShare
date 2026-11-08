const adminService = require('../services/adminService');
const { toPublicUser } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');

async function listUsers(req, res) {
  const { items, total } = await adminService.listUsers(req.query);
  res.json(toPage(items.map(toPublicUser), total, req.query));
}

async function setStatus(req, res) {
  const user = await adminService.setStatus(req.params.id, req.body, req.user);
  res.json({ user: toPublicUser(user) });
}

module.exports = { listUsers, setStatus };
