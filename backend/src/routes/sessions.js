const { Router } = require('express');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { loginSchema } = require('../validators/auth');
const { loginLimit } = require('../middleware/rateLimit');
const { optionalAuthenticate } = require('../middleware/auth');

const router = Router();

router.post('/', loginLimit, validate(loginSchema), controller.login);
router.get('/', optionalAuthenticate, controller.current);
router.delete('/', controller.logout);

module.exports = router;
