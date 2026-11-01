const { Router } = require('express');
const controller = require('../controllers/linksController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { idParamsSchema } = require('../validators/common');
const { linkSchema } = require('../validators/photos');

const router = Router({ mergeParams: true });

router.get('/', validate(idParamsSchema, 'params'), controller.list);
router.post(
  '/',
  authenticate,
  validate(idParamsSchema, 'params'),
  validate(linkSchema),
  controller.create,
);

module.exports = router;
