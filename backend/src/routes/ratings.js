const { Router } = require('express');
const controller = require('../controllers/ratingsController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { idParamsSchema, paginationSchema } = require('../validators/common');
const { ratingSchema } = require('../validators/ratings');

const STAFF = ['MODERATOR', 'ADMIN'];

// /api/photos/:id/ratings
const photoRatings = Router({ mergeParams: true });

photoRatings.post(
  '/',
  authenticate,
  validate(idParamsSchema, 'params'),
  validate(ratingSchema),
  controller.create,
);
photoRatings.get(
  '/',
  authenticate,
  requireRole(...STAFF),
  validate(idParamsSchema, 'params'),
  validate(paginationSchema, 'query'),
  controller.list,
);

// /api/ratings/:id
const ratings = Router();

ratings.delete(
  '/:id',
  authenticate,
  requireRole(...STAFF),
  validate(idParamsSchema, 'params'),
  controller.remove,
);

module.exports = { photoRatings, ratings };
