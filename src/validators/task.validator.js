const { body } = require('express-validator');

const taskRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('scope').optional({ checkFalsy: true }).isIn(['personal', 'team', 'department', 'project']),
  body('priority').optional({ checkFalsy: true }).isIn(['low', 'medium', 'high', 'critical']),
  body('status').optional({ checkFalsy: true }).isIn(['todo', 'in_progress', 'review', 'done', 'blocked']),
  body('assignedTo').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid assignee'),
  body('startDate').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().toDate(),
  body('progress').optional({ checkFalsy: true }).isInt({ min: 0, max: 100 }).toInt(),
];

const commentRules = [
  body('text').trim().notEmpty().withMessage('Comment cannot be empty').isLength({ max: 1000 }),
];

const statusRules = [
  body('status').isIn(['todo', 'in_progress', 'review', 'done', 'blocked']).withMessage('Invalid status'),
];

module.exports = { taskRules, commentRules, statusRules };
