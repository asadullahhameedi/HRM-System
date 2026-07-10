const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { isAuthenticated } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(isAuthenticated);

// All settings require admin role (HR can read via a separate route if needed)
router.use(requireRole('admin'));

// Render one scope's settings page
router.get('/', (req, res) => res.redirect('/settings/general'));
router.get('/general', settingsController.general);
router.get('/payroll', settingsController.payroll);
router.get('/attendance', settingsController.attendance);
router.get('/leave', settingsController.leave);
router.get('/appearance', settingsController.appearance);
router.get('/audit', settingsController.audit);

// Persist a scope's settings
router.post('/:scope', settingsController.save);

module.exports = router;
