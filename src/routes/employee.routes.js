const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { isAuthenticated } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { employeeCreateRules, employeeUpdateRules } = require('../validators/employee.validator');
const upload = require('../middleware/upload');

router.use(isAuthenticated);

// Search & export
router.get('/search', employeeController.search);
router.get('/export/excel', requireRole('admin', 'hr'), employeeController.exportExcel);

// CRUD
router.get('/', requireRole('admin', 'hr'), employeeController.index);
router.get('/create', requireRole('admin', 'hr'), employeeController.create);
router.post('/', requireRole('admin', 'hr'), upload.single('avatar'), employeeCreateRules, validate, employeeController.store);
router.get('/:id', employeeController.show);
router.get('/:id/edit', requireRole('admin', 'hr'), employeeController.edit);
router.put('/:id', requireRole('admin', 'hr'), upload.single('avatar'), employeeUpdateRules, validate, employeeController.update);
router.delete('/:id', requireRole('admin'), employeeController.destroy);

module.exports = router;
