const { Router } = require('express');
const controller = require('../controllers/photosController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const { idParamsSchema, paginationSchema } = require('../validators/common');
const {
  createPhotoSchema,
  updatePhotoSchema,
  idOrSlugParamsSchema,
} = require('../validators/photos');

const router = Router();

router.get('/', authenticate, validate(paginationSchema, 'query'), controller.feed);
router.post(
  '/',
  authenticate,
  uploadImage('image'),
  validate(createPhotoSchema),
  controller.create,
);
router.get('/:idOrSlug', validate(idOrSlugParamsSchema, 'params'), controller.getOne);
router.put(
  '/:id',
  authenticate,
  validate(idParamsSchema, 'params'),
  validate(updatePhotoSchema),
  controller.update,
);
router.delete('/:id', authenticate, validate(idParamsSchema, 'params'), controller.remove);

module.exports = router;
