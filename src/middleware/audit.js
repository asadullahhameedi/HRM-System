const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Lightweight audit logger. Call auditLog(req, { action, module, ... })
 * from controllers after a successful action. Non-blocking.
 */
async function auditLog(req, payload = {}) {
  try {
    const user = req.user;
    await AuditLog.create({
      action: payload.action,
      module: payload.module,
      actor: user?._id,
      actorName: user?.name || user?.email,
      actorRole: user?.role,
      target: payload.target ? String(payload.target) : undefined,
      targetType: payload.targetType,
      description: payload.description,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.originalUrl,
      status: payload.status || 'success',
      meta: payload.meta,
    });
  } catch (err) {
    // Audit must never break the request — log via winston, not console.
    logger.error('auditLog failed:', err.message);
  }
}

module.exports = auditLog;
