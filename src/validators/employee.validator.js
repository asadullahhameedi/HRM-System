const { body } = require('express-validator');

const employeeCreateRules = [
  body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 60 }),
  body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 60 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('gender').optional({ checkFalsy: true }).isIn(['male', 'female', 'other']),
  body('department').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid department'),
  body('designation').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid designation'),
  body('employmentType').optional({ checkFalsy: true }).isIn(['full-time', 'part-time', 'contract', 'intern']),
  body('joinDate').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('dateOfBirth').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('basicSalary').optional({ checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
];

const employeeUpdateRules = [
  body('firstName').optional({ checkFalsy: true }).trim().notEmpty().isLength({ max: 60 }),
  body('lastName').optional({ checkFalsy: true }).trim().notEmpty().isLength({ max: 60 }),
  body('email').optional({ checkFalsy: true }).trim().isEmail().normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('gender').optional({ checkFalsy: true }).isIn(['male', 'female', 'other']),
  body('department').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid department'),
  body('designation').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid designation'),
  body('employmentType').optional({ checkFalsy: true }).isIn(['full-time', 'part-time', 'contract', 'intern']),
  body('status').optional({ checkFalsy: true }).isIn(['active', 'inactive', 'terminated', 'resigned']),
  body('joinDate').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('dateOfBirth').optional({ checkFalsy: true }).isISO8601().toDate(),
];

module.exports = { employeeCreateRules, employeeUpdateRules };
