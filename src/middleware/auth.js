const ApiError = require('../utils/ApiError');

/**
 * Ensure a user is authenticated. Used on all protected routes.
 */
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.accepts('html')) {
    req.session.returnTo = req.originalUrl;
    req.flash('error', 'Please sign in to continue.');
    return res.redirect('/login');
  }
  return next(ApiError.unauthorized('Authentication required'));
}

// `optionalAuth` removed — was a no-op that was never wired into any route.

module.exports = { isAuthenticated };
