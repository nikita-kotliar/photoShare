const { Router } = require('express');
const controller = require('../controllers/commentsController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { idParamsSchema } = require('../validators/common');
const { commentSchema } = require('../validators/comments');

const router = Router();

router.put(
  '/:id',
  authenticate,
  validate(idParamsSchema, 'params'),
  validate(commentSchema),
  controller.update,
);
router.delete(
  '/:id',
  authenticate,
  requireRole('MODERATOR', 'ADMIN'),
  validate(idParamsSchema, 'params'),
  controller.remove,
);

module.exports = router;
