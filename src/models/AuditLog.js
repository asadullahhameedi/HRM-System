const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Immutable audit log for sensitive actions across the system.
 * Write-only: never updated or deleted by application code.
 */
const auditLogSchema = new Schema(
  {
    action: { type: String, required: true, index: true }, // e.g. 'employee.create'
    module: { type: String, required: true, index: true }, // e.g. 'employee'
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    actorRole: { type: String },
    target: { type: String }, // resource id as string
    targetType: { type: String },
    description: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    method: { type: String },
    path: { type: String },
    status: { type: String, enum: ['success', 'failure'], default: 'success' },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

auditLogSchema.index({ module: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
