const asyncHandler = require('../utils/asyncHandler');
const auth = require('../services/auth.service');
const auditLog = require('../middleware/audit');
const ApiError = require('../utils/ApiError');

const profile = asyncHandler(async (req, res) => {
  let employee = null;
  if (req.user.employee) {
    employee = await require('../models/Employee').findById(req.user.employee)
      .populate('department', 'name')
      .populate('designation', 'name')
      .lean();
  }
  res.render('profile/index', { title: 'My Profile', employee });
});

const updateProfile = asyncHandler(async (req, res, next) => {
  const { name, phone, address } = req.body;
  const update = { name };
  if (req.file) {
    update.avatar = '/uploads/' + req.file.filename;
  }
  const User = require('../models/User');
  const updated = await User.findByIdAndUpdate(req.user._id, update, { new: true }).select('-password');
  if (updated) {
    // Keep the in-session user object in sync so the redirect renders the new avatar
    req.user.avatar = updated.avatar;
    req.user.name = updated.name;
  }
  if (req.user.employee) {
    await require('../models/Employee').findByIdAndUpdate(req.user.employee, { phone, address });
  }
  await auditLog(req, { action: 'profile.update', module: 'profile', description: 'Updated profile' + (req.file ? ' (with avatar)' : '') });
  req.flash('success', 'Profile updated.');
  res.redirect('/profile');
});

const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) throw ApiError.badRequest('Passwords do not match.');
  if (newPassword.length < 8) throw ApiError.badRequest('Password must be at least 8 characters.');
  await auth.changePassword(req.user._id, currentPassword, newPassword);
  await auditLog(req, { action: 'profile.password', module: 'profile', description: 'Changed password' });
  req.flash('success', 'Password changed successfully.');
  res.redirect('/profile');
});

module.exports = { profile, updateProfile, changePassword };
