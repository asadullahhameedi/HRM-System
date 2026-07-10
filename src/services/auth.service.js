const bcrypt = require('bcryptjs');
const { User, Employee } = require('../models');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Auth service — supports user-account creation and password changes.
 *
 * Note: actual sign-in is handled by Passport (src/config/passport.js) —
 * there is no `login()` helper here. Account-lockout logic was previously
 * implemented as a `login()` function but never wired into the Passport
 * strategy, so it has been removed to avoid advertising a feature that
 * did not actually run. If you need lockout, hook it into the Passport
 * LocalStrategy's verify callback (config/passport.js).
 */

async function createUserAccount({ name, email, password, role = 'employee', employeeId }) {
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw ApiError.conflict('Email already registered.');

  const hashed = await bcrypt.hash(password, env.bcryptSaltRounds);
  const user = await User.create({
    name,
    email,
    password: hashed,
    role,
    status: 'active',
    employee: employeeId,
  });

  if (employeeId) {
    await Employee.findByIdAndUpdate(employeeId, { user: user._id });
  }
  return user;
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found.');

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) throw ApiError.badRequest('Current password is incorrect.');

  user.password = await bcrypt.hash(newPassword, env.bcryptSaltRounds);
  user.passwordChangedAt = new Date();
  await user.save();
}

module.exports = { createUserAccount, changePassword };
