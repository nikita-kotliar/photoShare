const { Router } = require('express');
const controller = require('../controllers/adminController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { idParamsSchema } = require('../validators/common');
const { usersQuerySchema, statusSchema } = require('../validators/admin');

const router = Router();

router.use(authenticate);

router.get(
  '/users',
  requireRole('MODERATOR', 'ADMIN'),
  validate(usersQuerySchema, 'query'),
  controller.listUsers,
);
router.patch(
  '/users/:id/status',
  requireRole('ADMIN'),
  validate(idParamsSchema, 'params'),
  validate(statusSchema),
  controller.setStatus,
);

module.exports = router;
