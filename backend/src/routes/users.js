const { Router } = require('express');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { registerSchema } = require('../validators/auth');

const router = Router();

router.post('/', validate(registerSchema), controller.register);
router.get('/me', authenticate, controller.me);

module.exports = router;
