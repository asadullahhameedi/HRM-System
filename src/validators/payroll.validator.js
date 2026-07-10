const { body } = require('express-validator');

const periodRules = [
  body('name').trim().notEmpty().withMessage('Period name is required'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be 1-12').toInt(),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Invalid year').toInt(),
  body('startDate').isISO8601().withMessage('Valid start date required').toDate(),
  body('endDate').isISO8601().withMessage('Valid end date required').toDate(),
  body('paymentDate').optional({ checkFalsy: true }).isISO8601().toDate(),
];

const salaryStructureRules = [
  body('employee').isMongoId().withMessage('Employee is required'),
  body('basicSalary').isFloat({ min: 0 }).withMessage('Basic salary must be >= 0').toFloat(),
  body('taxPercent').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('Tax must be 0-100').toFloat(),
  body('overtimeEnabled').optional({ checkFalsy: true }).toBoolean(),
  body('effectiveFrom').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('notes').optional({ checkFalsy: true }).trim(),
];

const loanRules = [
  body('employee').notEmpty().withMessage('Employee is required').bail().isMongoId().withMessage('Invalid employee'),
  body('type').notEmpty().withMessage('Type is required').bail().isIn(['loan', 'advance']).withMessage('Type must be loan or advance'),
  body('principal').notEmpty().withMessage('Principal is required').bail().isFloat({ min: 0 }).withMessage('Principal must be >= 0').toFloat(),
  body('installmentAmount').notEmpty().withMessage('Installment is required').bail().isFloat({ min: 0 }).withMessage('Installment must be >= 0').toFloat(),
  body('issuedDate').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
];

// For UPDATE: employee is optional (shown read-only in edit modal)
const loanUpdateRules = [
  body('employee').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid employee'),
  body('type').optional({ checkFalsy: true }).isIn(['loan', 'advance']),
  body('principal').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  body('installmentAmount').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  body('issuedDate').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('status').optional({ checkFalsy: true }).isIn(['active', 'cleared', 'cancelled']),
];

const payslipAdjustRules = [
  body('manualAdd').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  body('manualDeduct').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  body('overtimeHours').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  body('loanInstallment').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  body('advance').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
];

const loanPaymentRules = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid payment amount is required').toFloat(),
];

module.exports = { periodRules, salaryStructureRules, loanRules, loanUpdateRules, payslipAdjustRules, loanPaymentRules };
