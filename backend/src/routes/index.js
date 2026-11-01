const { Router } = require('express');
const users = require('./users');
const sessions = require('./sessions');
const photos = require('./photos');
const comments = require('./comments');
const links = require('./links');
const admin = require('./admin');

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
router.use('/users', users);
router.use('/sessions', sessions);
router.use('/photos/:id/links', links);
router.use('/photos', photos);
router.use('/comments', comments);
router.use('/admin', admin);

module.exports = router;
