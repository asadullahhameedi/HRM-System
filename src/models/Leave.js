const mongoose = require('mongoose');
const { Schema } = mongoose;

const LEAVE_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];
const LEAVE_DURATION = ['full-day', 'half-day'];

const leaveSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveType: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    duration: { type: String, enum: LEAVE_DURATION, default: 'full-day' },
    days: { type: Number, required: true, default: 1 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: LEAVE_STATUS, default: 'pending', index: true },

    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewRemarks: { type: String, trim: true },

    attachments: [{ name: String, url: String }],
  },
  { timestamps: true }
);

leaveSchema.index({ employee: 1, status: 1 });
leaveSchema.index({ fromDate: 1, toDate: 1 });

module.exports = mongoose.model('Leave', leaveSchema);
module.exports.LEAVE_STATUS = LEAVE_STATUS;
