const ApiError = require('../utils/ApiError');

/**
 * Role-Based Access Control middleware.
 *
 * Exposes only `requireRole(...roles)` — the only RBAC helper actually wired
 * into any route. The previous permission-matrix machinery (`can`,
 * `requirePermission`, `PERMISSIONS`, `requireRoleOrOwner`) was never used by
 * any route handler and `requireRoleOrOwner` had a latent bug (any employee
 * could bypass the role check); both have been removed to keep the surface
 * area honest. If you need fine-grained permission checks in the future,
 * reintroduce them and wire them into routes at the same time.
 */

function requireRole(...roles) {
  if (!roles.length) throw new Error('requireRole requires at least one role');
  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return next(ApiError.forbidden('You do not have permission to perform this action.'));
    }
    next();
  };
}

module.exports = { requireRole };
