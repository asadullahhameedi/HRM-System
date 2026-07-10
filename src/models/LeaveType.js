const mongoose = require('mongoose');
const { Schema } = mongoose;

const leaveTypeSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String },
    defaultDays: { type: Number, default: 0 }, // annual entitlement
    isPaid: { type: Boolean, default: true },
    carryForward: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
