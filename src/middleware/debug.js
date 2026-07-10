const logger = require('../utils/logger');
const env = require('../config/env');

function debugLogger(req, _res, next) {
  if (env.isDev && req.method === 'POST' && req.path && !req.path.startsWith('/public')) {
    const safeBody = { ...req.body };
    if (safeBody.password) safeBody.password = '[REDACTED]';
    if (safeBody.currentPassword) safeBody.currentPassword = '[REDACTED]';
    if (safeBody.newPassword) safeBody.newPassword = '[REDACTED]';
    if (safeBody.confirmPassword) safeBody.confirmPassword = '[REDACTED]';
    logger.debug(`[REQ] ${req.method} ${req.originalUrl}`, { body: safeBody, params: req.params, query: req.query });
  }
  next();
}

module.exports = debugLogger;
