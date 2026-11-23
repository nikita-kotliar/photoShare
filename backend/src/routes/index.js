const { Router } = require('express');
const users = require('./users');
const sessions = require('./sessions');
const photos = require('./photos');
const comments = require('./comments');
const links = require('./links');
const { photoRatings, ratings } = require('./ratings');
const admin = require('./admin');
const search = require('./search');
const notifications = require('./notifications');
const docs = require('../docs/swagger');

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
router.use(docs.router);
router.use('/users', users);
router.use('/sessions', sessions);
router.use('/photos/:id/links', links);
router.use('/photos/:id/ratings', photoRatings);
router.use('/photos', photos);
router.use('/comments', comments);
router.use('/ratings', ratings);
router.use('/search', search);
router.use('/notifications', notifications);
router.use('/admin', admin);

module.exports = router;
