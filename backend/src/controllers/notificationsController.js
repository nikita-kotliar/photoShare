const notificationsService = require('../services/notificationsService');
const { toNotification } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');

async function list(req, res) {
  const { items, total } = await notificationsService.list(req.user, req.query);
  res.json(toPage(items.map(toNotification), total, req.query));
}

async function unreadCount(req, res) {
  res.json({ count: await notificationsService.unreadCount(req.user) });
}

async function markRead(req, res) {
  res.json(await notificationsService.markRead(req.user, req.body ?? {}));
}

module.exports = { list, unreadCount, markRead };
