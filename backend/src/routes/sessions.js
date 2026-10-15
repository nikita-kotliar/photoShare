const { Router } = require('express');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { loginSchema } = require('../validators/auth');

const router = Router();

router.post('/', validate(loginSchema), controller.login);
router.delete('/', controller.logout);

module.exports = router;
