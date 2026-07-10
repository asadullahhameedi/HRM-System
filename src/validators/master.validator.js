const { body } = require('express-validator');

const departmentRules = [
  body('name').trim().notEmpty().withMessage('Department name is required').isLength({ max: 80 }),
  body('code').trim().notEmpty().withMessage('Code is required').isLength({ max: 20 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('status').optional({ checkFalsy: true }).isIn(['active', 'inactive']),
];

const designationRules = [
  body('name').trim().notEmpty().withMessage('Designation name is required').isLength({ max: 80 }),
  body('department').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid department'),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('status').optional({ checkFalsy: true }).isIn(['active', 'inactive']),
];

module.exports = { departmentRules, designationRules };
