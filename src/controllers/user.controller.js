const asyncHandler = require('../utils/asyncHandler');
const auditLog = require('../middleware/audit');
const ApiError = require('../utils/ApiError');
const { User } = require('../models');
const authService = require('../services/auth.service');

// List all users
const index = asyncHandler(async (req, res) => {
  const users = await User.find()
    .sort({ createdAt: -1 })
    .lean();
  res.render('users/index', {
    title: 'User Management',
    users,
  });
});

// Show create form
const create = asyncHandler(async (req, res) => {
  res.render('users/form', {
    title: 'Add User',
    user: {},
    isEdit: false,
  });
});

// Create user (password hashed via auth.service.js)
const store = asyncHandler(async (req, res, next) => {
  const { name, email, password, role, status } = req.body;
  if (!name || !email || !password) {
    throw ApiError.badRequest('Name, email and password are required.');
  }
  const user = await authService.createUserAccount({
    name,
    email,
    password,
    role: role || 'employee',
  });
  // authService.createUserAccount always sets status='active'; honor the form value if different
  if (status && status !== 'active') {
    user.status = status;
    await user.save();
  }
  await auditLog(req, {
    action: 'user.create',
    module: 'user',
    target: user._id,
    targetType: 'User',
    description: `Created user ${user.email} (${user.role})`,
  });
  req.flash('success', 'User created.');
  res.redirect('/users');
});

// Show edit form
const edit = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw ApiError.notFound('User not found.');
  res.render('users/form', {
    title: 'Edit User',
    user,
    isEdit: true,
  });
});

// Update name / email / role / status
const update = asyncHandler(async (req, res, next) => {
  const { name, email, role, status } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  if (email && email.toLowerCase() !== user.email) {
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) throw ApiError.conflict('Email already registered.');
    user.email = email.toLowerCase().trim();
  }
  if (name) user.name = name.trim();
  if (role) user.role = role;
  if (status) user.status = status;
  await user.save();

  await auditLog(req, {
    action: 'user.update',
    module: 'user',
    target: user._id,
    targetType: 'User',
    description: `Updated user ${user.email} (${user.role})`,
  });
  req.flash('success', 'User updated.');
  res.redirect('/users');
});

// Delete user (cannot delete self)
const destroy = asyncHandler(async (req, res, next) => {
  if (String(req.params.id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot delete your own account.');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  const email = user.email;
  await user.deleteOne();
  await auditLog(req, {
    action: 'user.delete',
    module: 'user',
    target: req.params.id,
    targetType: 'User',
    description: `Deleted user ${email}`,
  });
  req.flash('success', 'User deleted.');
  res.redirect('/users');
});

module.exports = { index, create, store, edit, update, destroy };
