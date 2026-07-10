const { Task, Employee } = require('../models');
const ApiError = require('../utils/ApiError');
const { parseQuery } = require('../utils/pagination');
const mongoose = require('mongoose');

/**
 * Roles that see ALL tasks regardless of scope/assignment.
 * Mirrors `ROLES` in models/User.js — `'manager'` is intentionally NOT
 * included because no such role exists in the system.
 */
const OVERSIGHT_ROLES = ['admin', 'hr'];

/**
 * Resolve the employee's department ObjectId (if any) for department-scoped
 * task filtering. Cached on the request to avoid repeated lookups within
 * the same request lifecycle.
 */
async function getEmployeeDepartment(req) {
  if (!req.user || !req.user.employee) return null;
  if (req._taskEmployeeDept !== undefined) return req._taskEmployeeDept;
  let dept = null;
  try {
    const emp = await Employee.findById(req.user.employee).select('department').lean();
    dept = emp?.department || null;
  } catch (_e) {
    dept = null;
  }
  req._taskEmployeeDept = dept;
  return dept;
}

/**
 * Tasks list with role-based visibility:
 * - admins/hr see everything
 * - everyone else only sees tasks assigned to them, created by them,
 *   team-scoped tasks, OR department-scoped tasks for THEIR OWN department.
 */
async function listTasks(req) {
  const { page, limit, skip, sort, search } = parseQuery(req, {
    searchableFields: ['title', 'description'],
  });

  const query = { ...search };
  if (req.query.status) query.status = req.query.status;
  if (req.query.priority) query.priority = req.query.priority;
  if (req.query.scope) query.scope = req.query.scope;
  if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;
  if (req.query.department) query.department = req.query.department;

  // Scope-based visibility for non-oversight roles
  if (req.user && !OVERSIGHT_ROLES.includes(req.user.role)) {
    const orClauses = [
      { assignedTo: req.user._id },
      { createdBy: req.user._id },
      { scope: 'team' },
    ];
    const dept = await getEmployeeDepartment(req);
    if (dept) {
      // Department-scoped tasks are visible ONLY for the employee's own
      // department — fixing a previous leak where ANY employee with an
      // employee ref saw ALL department-scoped tasks.
      orClauses.push({ scope: 'department', department: dept });
    }
    query.$and = [
      ...(query.$and || []),
      { $or: orClauses },
    ];
  }

  // Due-date range filter
  if (req.query.from || req.query.to) {
    query.dueDate = query.dueDate || {};
    if (req.query.from) query.dueDate.$gte = new Date(req.query.from);
    if (req.query.to) query.dueDate.$lte = new Date(req.query.to);
  }

  const [items, total] = await Promise.all([
    Task.find(query)
      .populate('assignedTo', 'name email avatar')
      .populate('assignedBy', 'name')
      .populate('createdBy', 'name')
      .populate('department', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Task.countDocuments(query),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getTask(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid task id.');
  const task = await Task.findById(id)
    .populate('assignedTo', 'name email avatar')
    .populate('assignedBy', 'name')
    .populate('createdBy', 'name')
    .populate('department', 'name code')
    .populate('comments.author', 'name avatar');
  if (!task) throw ApiError.notFound('Task not found.');
  return task;
}

async function createTask(data, createdBy) {
  const payload = { ...data, createdBy };
  if (payload.assignedTo) payload.assignedBy = createdBy;
  if (payload.labels && typeof payload.labels === 'string') {
    payload.labels = payload.labels.split(',').map((l) => l.trim()).filter(Boolean);
  }
  return Task.create(payload);
}

async function updateTask(id, data, user) {
  const task = await Task.findById(id);
  if (!task) throw ApiError.notFound('Task not found.');

  // Non-oversight roles can only update tasks they own or are assigned to
  if (user && !OVERSIGHT_ROLES.includes(user.role)) {
    const isOwner = String(task.createdBy) === String(user._id);
    const isAssignee = task.assignedTo && String(task.assignedTo) === String(user._id);
    if (!isOwner && !isAssignee) {
      throw ApiError.forbidden('You can only update tasks you own or are assigned to.');
    }
  }

  if (data.labels && typeof data.labels === 'string') {
    data.labels = data.labels.split(',').map((l) => l.trim()).filter(Boolean);
  }
  if (data.status === 'done' && task.status !== 'done') {
    data.completedAt = new Date();
    if (data.progress === undefined) data.progress = 100;
  }
  Object.assign(task, data);
  await task.save();
  return task;
}

async function deleteTask(id, user) {
  const task = await Task.findById(id);
  if (!task) throw ApiError.notFound('Task not found.');
  if (user && user.role !== 'admin') {
    const isOwner = String(task.createdBy) === String(user._id);
    if (!isOwner) throw ApiError.forbidden('Only the task owner or an admin can delete this task.');
  }
  await task.deleteOne();
  return task;
}

async function addComment(id, text, author) {
  const task = await Task.findById(id);
  if (!task) throw ApiError.notFound('Task not found.');
  task.comments.push({ author, text });
  await task.save();
  return task.comments[task.comments.length - 1];
}

/**
 * Return tasks grouped by status for a kanban board.
 */
async function getKanbanBoard(req) {
  const baseQuery = {};
  if (req.query.priority) baseQuery.priority = req.query.priority;
  if (req.query.scope) baseQuery.scope = req.query.scope;
  if (req.query.department) baseQuery.department = req.query.department;

  // Role-based visibility — same logic as listTasks
  if (req.user && !OVERSIGHT_ROLES.includes(req.user.role)) {
    const orClauses = [
      { assignedTo: req.user._id },
      { createdBy: req.user._id },
      { scope: 'team' },
    ];
    const dept = await getEmployeeDepartment(req);
    if (dept) orClauses.push({ scope: 'department', department: dept });
    baseQuery.$or = orClauses;
  }

  const statuses = ['todo', 'in_progress', 'review', 'done', 'blocked'];
  const tasks = await Task.find(baseQuery)
    .populate('assignedTo', 'name avatar')
    .populate('department', 'name')
    .sort({ priority: -1, dueDate: 1 })
    .lean();

  const grouped = statuses.reduce((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {});
  return grouped;
}

async function updateStatus(id, status, user) {
  const task = await Task.findById(id);
  if (!task) throw ApiError.notFound('Task not found.');

  if (user && !OVERSIGHT_ROLES.includes(user.role)) {
    const isOwner = String(task.createdBy) === String(user._id);
    const isAssignee = task.assignedTo && String(task.assignedTo) === String(user._id);
    if (!isOwner && !isAssignee) {
      throw ApiError.forbidden('You can only update tasks you own or are assigned to.');
    }
  }

  task.status = status;
  if (status === 'done') {
    task.completedAt = new Date();
    if (task.progress < 100) task.progress = 100;
  } else if (status !== 'done' && task.completedAt) {
    task.completedAt = undefined;
  }
  await task.save();
  return task;
}

async function getStats(req) {
  const baseQuery = {};
  if (req.user && !OVERSIGHT_ROLES.includes(req.user.role)) {
    const orClauses = [
      { assignedTo: req.user._id },
      { createdBy: req.user._id },
      { scope: 'team' },
    ];
    const dept = await getEmployeeDepartment(req);
    if (dept) orClauses.push({ scope: 'department', department: dept });
    baseQuery.$or = orClauses;
  }
  const [total, byStatus, byPriority, overdue] = await Promise.all([
    Task.countDocuments(baseQuery),
    Task.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Task.countDocuments({
      ...baseQuery,
      dueDate: { $lt: new Date() },
      status: { $nin: ['done', 'blocked'] },
    }),
  ]);

  const statusMap = byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {});
  const priorityMap = byPriority.reduce((acc, p) => ({ ...acc, [p._id]: p.count }), {});

  return {
    total,
    overdue,
    todo: statusMap.todo || 0,
    in_progress: statusMap.in_progress || 0,
    review: statusMap.review || 0,
    done: statusMap.done || 0,
    blocked: statusMap.blocked || 0,
    low: priorityMap.low || 0,
    medium: priorityMap.medium || 0,
    high: priorityMap.high || 0,
    critical: priorityMap.critical || 0,
  };
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  addComment,
  getKanbanBoard,
  updateStatus,
  getStats,
};
