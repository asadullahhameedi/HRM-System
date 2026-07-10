const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { isAuthenticated } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { taskRules, commentRules, statusRules } = require('../validators/task.validator');

router.use(isAuthenticated);

// Task list + kanban
router.get('/', taskController.index);
router.get('/kanban', taskController.kanban);

// Create
router.get('/create', taskController.create);
router.post('/', taskRules, validate, taskController.store);

// Single task
router.get('/:id', taskController.show);
router.get('/:id/edit', taskController.edit);
router.put('/:id', taskRules, validate, taskController.update);
router.delete('/:id', taskController.destroy);

// Status & comments
router.post('/:id/status', statusRules, validate, taskController.updateStatus);
router.post('/:id/comments', commentRules, validate, taskController.addComment);

module.exports = router;
