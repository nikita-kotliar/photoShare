const { Router } = require('express');
const controller = require('../controllers/googleAuthController');
const { googleLimit } = require('../middleware/rateLimit');

const router = Router();

router.get('/google', googleLimit, controller.start);
router.get('/google/callback', controller.callback);

module.exports = router;
