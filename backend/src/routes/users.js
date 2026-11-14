const { Router } = require('express');
const authController = require('../controllers/authController');
const controller = require('../controllers/usersController');
const validate = require('../middleware/validate');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { registerSchema } = require('../validators/auth');
const { usernameParamsSchema, updateMeSchema } = require('../validators/users');
const { paginationSchema } = require('../validators/common');

const router = Router();

router.post('/', validate(registerSchema), authController.register);

// ====== /me має бути оголошений раніше за /:username, інакше "me" вважатиметься юзернеймом ======
router.get('/me', authenticate, controller.me);
router.put('/me', authenticate, validate(updateMeSchema), controller.updateMe);

router.get('/:username', validate(usernameParamsSchema, 'params'), controller.getProfile);
router.get(
  '/:username/photos',
  optionalAuthenticate,
  validate(usernameParamsSchema, 'params'),
  validate(paginationSchema, 'query'),
  controller.listPhotos,
);

module.exports = router;
