const { body } = require('express-validator');

// For CREATE: employee and date are required
const attendanceRules = [
  body('employee').isMongoId().withMessage('Employee is required'),
  body('date').isISO8601().withMessage('Valid date is required').toDate(),
  body('status').optional({ checkFalsy: true }).isIn(['present', 'absent', 'late', 'half-day', 'leave', 'holiday']),
  body('checkIn').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('checkOut').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('overtimeHours').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body('remarks').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
];

// For UPDATE: employee is optional (shown read-only in edit modal, may not be sent)
const attendanceUpdateRules = [
  body('employee').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid employee'),
  body('date').optional({ checkFalsy: true }).isISO8601().withMessage('Valid date is required').toDate(),
  body('status').optional({ checkFalsy: true }).isIn(['present', 'absent', 'late', 'half-day', 'leave', 'holiday']),
  body('checkIn').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('checkOut').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('overtimeHours').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body('remarks').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
];

// For CREATE: all identity fields required
const leaveRules = [
  body('employee').isMongoId().withMessage('Employee is required'),
  body('leaveType').isMongoId().withMessage('Leave type is required'),
  body('fromDate').isISO8601().withMessage('Valid from date is required').toDate(),
  body('toDate').isISO8601().withMessage('Valid to date is required').toDate(),
  body('reason').trim().notEmpty().withMessage('Reason is required').isLength({ max: 500 }),
  body('duration').optional({ checkFalsy: true }).isIn(['full-day', 'half-day']),
];

// For UPDATE: identity fields optional (employee shown read-only in edit modal)
const leaveUpdateRules = [
  body('employee').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid employee'),
  body('leaveType').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid leave type'),
  body('fromDate').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('toDate').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('reason').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('duration').optional({ checkFalsy: true }).isIn(['full-day', 'half-day']),
  body('status').optional({ checkFalsy: true }).isIn(['pending', 'approved', 'rejected', 'cancelled']),
];

const leaveReviewRules = [
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  body('reviewRemarks').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
];

const holidayRules = [
  body('name').trim().notEmpty().withMessage('Holiday name is required'),
  body('date').isISO8601().withMessage('Valid date is required').toDate(),
  body('type').optional({ checkFalsy: true }).isIn(['national', 'religious', 'company', 'other']),
  body('isRecurring').optional({ checkFalsy: true }).toBoolean(),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
];

module.exports = { attendanceRules, attendanceUpdateRules, leaveRules, leaveUpdateRules, leaveReviewRules, holidayRules };
