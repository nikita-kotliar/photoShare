const { Router } = require('express');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { loginSchema } = require('../validators/auth');
const { loginLimit } = require('../middleware/rateLimit');

const router = Router();

router.post('/', loginLimit, validate(loginSchema), controller.login);
router.delete('/', controller.logout);

module.exports = router;
