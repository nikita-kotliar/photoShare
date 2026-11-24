const { Router } = require('express');
const controller = require('../controllers/passwordController');
const validate = require('../middleware/validate');
const { rateLimit } = require('../middleware/rateLimit');
const { forgotSchema, resetSchema } = require('../validators/password');

const forgotLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Забагато запитів на відновлення. Спробуйте за годину',
});
const resetLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Забагато спроб. Спробуйте за 15 хвилин',
});

const router = Router();

router.post('/forgot', forgotLimit, validate(forgotSchema), controller.forgot);
router.post('/reset', resetLimit, validate(resetSchema), controller.reset);

module.exports = router;
