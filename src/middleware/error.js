const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * Central error handler. Converts ApiError to JSON for XHR requests
 * and renders an error page for browser requests.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  const isOperational = !!err.isOperational;

  if (statusCode >= 500) {
    logger.error(`[${req.method} ${req.originalUrl}] ${err.message}`, { stack: err.stack });
  } else if (!isOperational) {
    logger.warn(`[${req.method} ${req.originalUrl}] ${err.message}`);
  }

  // Validation details
  const details = err.details || undefined;

  if (req.xhr || req.accepts(['json', 'html']) === 'json') {
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'Internal server error',
      ...(details ? { errors: details } : {}),
      ...(env.isDev ? { stack: err.stack } : {}),
    });
  }

  // HTML: render error page if available, else simple message
  if (statusCode === 404) {
    return res.status(404).render('errors/404', {
      title: 'Page Not Found',
      layout: false,
      user: req.user || null,
      message: err.message,
    });
  }
  return res.status(statusCode).render('errors/500', {
    title: 'Server Error',
    layout: false,
    user: req.user || null,
    message: env.isProd && statusCode >= 500 ? 'Something went wrong. Please try again later.' : err.message,
    stack: env.isDev ? err.stack : null,
  });
}

function notFound(req, res, next) {
  next(ApiError.notFound(`The page "${req.originalUrl}" was not found.`));
}

module.exports = { errorHandler, notFound };
