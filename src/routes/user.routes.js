const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { isAuthenticated } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(isAuthenticated, requireRole('admin'));
router.get('/', userController.index);
router.get('/create', userController.create);
router.post('/', userController.store);
router.get('/:id/edit', userController.edit);
router.put('/:id', userController.update);
router.delete('/:id', userController.destroy);

module.exports = router;
