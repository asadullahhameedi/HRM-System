const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const { isAuthenticated } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(isAuthenticated);

// Report dashboard — all authenticated users can see the dashboard
// (employees see their own scoped data in detail pages)
router.get('/', reportsController.index);

// All reports: admin/hr/finance see everything, employees see their own data
// (the controller's applyEmployeeScope() filters by req.user.employee for employees)
router.get('/payroll-summary', requireRole('admin', 'hr', 'finance'), reportsController.payrollSummary);
router.get('/payroll-register', requireRole('admin', 'hr', 'finance'), reportsController.payrollRegister);
router.get('/salary', requireRole('admin', 'hr', 'finance'), reportsController.salaryReport);
router.get('/employee-payroll', reportsController.employeePayrollReport);
router.get('/employee', reportsController.employeeReport);
router.get('/attendance', reportsController.attendanceReport);
router.get('/overtime', reportsController.overtimeReport);
router.get('/leave', reportsController.leaveReport);
router.get('/deduction', requireRole('admin', 'hr', 'finance'), reportsController.deductionReport);
router.get('/loan', requireRole('admin', 'hr', 'finance'), reportsController.loanReport);
router.get('/tax', requireRole('admin', 'hr', 'finance'), reportsController.taxReport);
router.get('/bonus', requireRole('admin', 'hr', 'finance'), reportsController.bonusReport);
router.get('/department', requireRole('admin', 'hr', 'finance'), reportsController.departmentReport);
router.get('/user-activity', requireRole('admin'), reportsController.userActivity);

module.exports = router;
