const express = require('express');
const router = express.Router();
const masterController = require('../controllers/master.controller');
const { isAuthenticated } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { departmentRules, designationRules } = require('../validators/master.validator');

router.use(isAuthenticated);

// Departments
router.get('/departments', requireRole('admin', 'hr'), masterController.departments);
router.post('/departments', requireRole('admin', 'hr'), departmentRules, validate, masterController.storeDepartment);
router.put('/departments/:id', requireRole('admin', 'hr'), departmentRules, validate, masterController.updateDepartment);
router.delete('/departments/:id', requireRole('admin'), masterController.destroyDepartment);

// Designations
router.get('/designations', requireRole('admin', 'hr'), masterController.designations);
router.post('/designations', requireRole('admin', 'hr'), designationRules, validate, masterController.storeDesignation);
router.put('/designations/:id', requireRole('admin', 'hr'), designationRules, validate, masterController.updateDesignation);
router.delete('/designations/:id', requireRole('admin'), masterController.destroyDesignation);

module.exports = router;
