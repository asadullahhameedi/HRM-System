const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const { isAuthenticated } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { periodRules, salaryStructureRules, loanRules, loanUpdateRules, payslipAdjustRules, loanPaymentRules } = require('../validators/payroll.validator');

router.use(isAuthenticated);

// Redirect /payroll to /payroll/payslips (legacy)
router.get('/', (req, res) => res.redirect('/payroll/payslips'));

// Periods (kept for internal use — payroll run generates payslips)
router.get('/periods', requireRole('admin', 'hr', 'finance'), payrollController.periods);
router.post('/periods', requireRole('admin', 'hr', 'finance'), periodRules, validate, payrollController.storePeriod);
router.get('/periods/:id', requireRole('admin', 'hr', 'finance'), payrollController.periodDetail);
router.put('/periods/:id', requireRole('admin', 'hr', 'finance'), payrollController.updatePeriod);
router.post('/periods/:id/status', requireRole('admin', 'hr', 'finance'), payrollController.periodStatus);
router.post('/periods/:id/lock', requireRole('admin', 'hr', 'finance'), payrollController.lockPeriod);
router.post('/periods/:id/unlock', requireRole('admin'), payrollController.unlockPeriod);
router.post('/periods/:id/recalculate', requireRole('admin', 'hr', 'finance'), payrollController.recalculatePeriod);
router.post('/periods/:periodId/run', requireRole('admin', 'hr', 'finance'), payrollController.runPayroll);
router.post('/periods/:periodId/generate', requireRole('admin', 'hr', 'finance'), payrollController.generateSingle);
router.get('/periods/:periodId/export', requireRole('admin', 'hr', 'finance'), payrollController.exportPeriodExcel);
router.delete('/periods/:id', requireRole('admin'), payrollController.destroyPeriod);

// Salary structures
router.get('/structures', requireRole('admin', 'hr', 'finance'), payrollController.structures);
router.get('/structures/create', requireRole('admin', 'hr', 'finance'), payrollController.structureForm);
router.get('/structures/:id/edit', requireRole('admin', 'hr', 'finance'), payrollController.structureForm);
router.post('/structures', requireRole('admin', 'hr', 'finance'), salaryStructureRules, validate, payrollController.storeStructure);
router.put('/structures/:id', requireRole('admin', 'hr', 'finance'), payrollController.updateStructure);
router.delete('/structures/:id', requireRole('admin', 'hr', 'finance'), payrollController.destroyStructure);

// Loans
router.get('/loans', requireRole('admin', 'hr', 'finance'), payrollController.loans);
router.post('/loans', requireRole('admin', 'hr', 'finance'), loanRules, validate, payrollController.storeLoan);
router.put('/loans/:id', requireRole('admin', 'hr', 'finance'), loanUpdateRules, validate, payrollController.updateLoan);
router.delete('/loans/:id', requireRole('admin'), payrollController.destroyLoan);
router.post('/loans/:id/payment', requireRole('admin', 'hr', 'finance'), loanPaymentRules, validate, payrollController.recordLoanPayment);

// Payslips — Full CRUD
router.get('/payslips', payrollController.payslips);
router.get('/payslips/create', requireRole('admin', 'hr', 'finance'), payrollController.payslipCreateForm);
// AJAX preview endpoint — must be defined BEFORE /payslips/:id so :id doesn't catch "preview"
router.get('/payslips/preview', requireRole('admin', 'hr', 'finance'), payrollController.payslipPreview);
router.post('/payslips', requireRole('admin', 'hr', 'finance'), payrollController.generateSingle);
router.get('/payslips/:id', payrollController.payslipDetail);
// Edit route removed — was non-functional. Use Adjust modal on detail page instead.
router.post('/payslips/:id/adjust', requireRole('admin', 'hr', 'finance'), payslipAdjustRules, validate, payrollController.adjustPayslip);
router.post('/payslips/:id/approve', requireRole('admin', 'hr', 'finance'), payrollController.approvePayslip);
router.delete('/payslips/:id', requireRole('admin', 'hr', 'finance'), payrollController.destroyPayslip);
router.get('/payslips/:id/pdf', payrollController.downloadPayslipPDF);

module.exports = router;
