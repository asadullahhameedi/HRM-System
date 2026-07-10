const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { isAuthenticated } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const upload = require('../middleware/upload');

router.use(isAuthenticated);

// List + detail
router.get('/', documentController.index);
router.get('/create', requireRole('admin', 'hr'), documentController.create);
router.post('/', requireRole('admin', 'hr'), upload.single('file'), documentController.store);
router.get('/:id', documentController.show);
router.get('/:id/download', documentController.download);
router.get('/:id/edit', requireRole('admin', 'hr'), documentController.edit);
router.put('/:id', requireRole('admin', 'hr'), upload.single('file'), documentController.update);
router.delete('/:id', requireRole('admin'), documentController.destroy);

// Workflow actions
router.post('/:id/approve', requireRole('admin', 'hr'), documentController.approve);
router.post('/:id/reject', requireRole('admin', 'hr'), documentController.reject);
router.post('/:id/archive', requireRole('admin', 'hr'), documentController.archive);

module.exports = router;
