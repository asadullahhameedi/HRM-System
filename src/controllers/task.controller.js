const asyncHandler = require('../utils/asyncHandler');
const taskService = require('../services/task.service');
const auditLog = require('../middleware/audit');
const { paginate } = require('../utils/pagination');
const User = require('../models/User');
const Department = require('../models/Department');

/**
 * Parse comma-separated labels string into a clean array.
 */
function parseLabels(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Strip empty-string fields so mongoose doesn't store "" where it should store undefined.
 */
function cleanPayload(body) {
  const cleaned = { ...body };
  ['assignedTo', 'startDate', 'dueDate', 'department'].forEach((key) => {
    if (cleaned[key] === '' || cleaned[key] === undefined) delete cleaned[key];
  });
  cleaned.labels = parseLabels(body.labels);
  if (cleaned.progress !== undefined && cleaned.progress !== '') {
    cleaned.progress = Number(cleaned.progress);
  } else {
    delete cleaned.progress;
  }
  return cleaned;
}

const index = asyncHandler(async (req, res) => {
  const [{ items, total, page, limit, totalPages }, stats, users, departments] = await Promise.all([
    taskService.listTasks(req),
    taskService.getStats(req),
    User.find({ status: 'active' }).select('name email').lean(),
    Department.find({ status: 'active' }).select('name code').lean(),
  ]);

  res.render('tasks/index', {
    title: 'Tasks',
    tasks: items,
    stats,
    users,
    departments,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const kanban = asyncHandler(async (req, res) => {
  const board = await taskService.getKanbanBoard(req);
  const [users, departments] = await Promise.all([
    User.find({ status: 'active' }).select('name email').lean(),
    Department.find({ status: 'active' }).select('name code').lean(),
  ]);
  res.render('tasks/kanban', {
    title: 'Task Board',
    board,
    users,
    departments,
    filters: req.query,
  });
});

const show = asyncHandler(async (req, res) => {
  const task = await taskService.getTask(req.params.id);
  res.render('tasks/show', {
    title: task.title,
    task,
  });
});

const create = asyncHandler(async (req, res) => {
  const [users, departments] = await Promise.all([
    User.find({ status: 'active' }).select('name email').lean(),
    Department.find({ status: 'active' }).select('name code').lean(),
  ]);
  res.render('tasks/form', {
    title: 'New Task',
    task: {},
    users,
    departments,
    isEdit: false,
  });
});

const store = asyncHandler(async (req, res, next) => {
  const data = cleanPayload(req.body);
  const task = await taskService.createTask(data, req.user._id);
  await auditLog(req, {
    action: 'task.create',
    module: 'task',
    target: task._id,
    description: `Created task "${task.title}"`,
  });
  req.flash('success', 'Task created.');
  res.redirect(`/tasks/${task._id}`);
});

const edit = asyncHandler(async (req, res) => {
  const task = await taskService.getTask(req.params.id);
  const [users, departments] = await Promise.all([
    User.find({ status: 'active' }).select('name email').lean(),
    Department.find({ status: 'active' }).select('name code').lean(),
  ]);
  res.render('tasks/form', {
    title: `Edit: ${task.title}`,
    task,
    users,
    departments,
    isEdit: true,
  });
});

const update = asyncHandler(async (req, res, next) => {
  const data = cleanPayload(req.body);
  const task = await taskService.updateTask(req.params.id, data, req.user);
  await auditLog(req, {
    action: 'task.update',
    module: 'task',
    target: task._id,
    description: `Updated task "${task.title}"`,
  });
  req.flash('success', 'Task updated.');
  res.redirect(`/tasks/${task._id}`);
});

const destroy = asyncHandler(async (req, res, next) => {
  const task = await taskService.deleteTask(req.params.id, req.user);
  await auditLog(req, {
    action: 'task.delete',
    module: 'task',
    target: req.params.id,
    description: `Deleted task "${task.title}"`,
  });
  req.flash('success', 'Task deleted.');
  res.redirect('/tasks');
});

const updateStatus = asyncHandler(async (req, res, next) => {
  const task = await taskService.updateStatus(req.params.id, req.body.status, req.user);
  await auditLog(req, {
    action: 'task.status',
    module: 'task',
    target: task._id,
    description: `Task "${task.title}" → ${task.status}`,
  });
  req.flash('success', `Status updated to "${task.status}".`);
  res.redirect(`/tasks/${task._id}`);
});

const addComment = asyncHandler(async (req, res, next) => {
  await taskService.addComment(req.params.id, req.body.text, req.user._id);
  await auditLog(req, {
    action: 'task.comment',
    module: 'task',
    target: req.params.id,
    description: `Added comment on task`,
  });
  req.flash('success', 'Comment added.');
  res.redirect(`/tasks/${req.params.id}`);
});

module.exports = {
  index,
  kanban,
  show,
  create,
  store,
  edit,
  update,
  destroy,
  updateStatus,
  addComment,
};
