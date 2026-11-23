const { Router } = require('express');
const controller = require('../controllers/notificationsController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { paginationSchema } = require('../validators/common');
const { markReadSchema } = require('../validators/notifications');

const router = Router();

router.use(authenticate);
router.get('/', validate(paginationSchema, 'query'), controller.list);
router.get('/unread-count', controller.unreadCount);
router.post('/read', validate(markReadSchema), controller.markRead);

module.exports = router;
