const { Router } = require('express');
const controller = require('../controllers/googleAuthController');

const router = Router();

router.get('/google', controller.start);
router.get('/google/callback', controller.callback);

module.exports = router;
