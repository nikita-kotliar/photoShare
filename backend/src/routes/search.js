const { Router } = require('express');
const controller = require('../controllers/searchController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { searchQuerySchema } = require('../validators/search');

const router = Router();

router.get('/photos', authenticate, validate(searchQuerySchema, 'query'), controller.photos);

module.exports = router;
