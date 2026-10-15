const { Router } = require('express');
const users = require('./users');
const sessions = require('./sessions');

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
router.use('/users', users);
router.use('/sessions', sessions);

module.exports = router;
