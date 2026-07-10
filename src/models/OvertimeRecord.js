const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Standalone overtime records (separate from Attendance.overtimeHours).
 *
 * Why both? Attendance rows capture the hours an employee worked on a given
 * day (including any OT that day). This OvertimeRecord model captures OT as
 * a discrete authorization/payment unit — useful when OT is approved
 * separately from attendance, batched per period, or paid at a different
 * rate than the standard multiplier.
 *
 * Approved records are pulled into the next payslip as an OT line item.
 */
const OT_STATUS = ['pending', 'approved', 'rejected', 'paid'];

const overtimeRecordSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    period: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', index: true },
    date: { type: Date, required: true, index: true },
    hours: { type: Number, required: true, min: 0 },
    rate: { type: Number, default: 1.5, min: 0 }, // multiplier (e.g. 1.5x, 2.0x)
    hourlyRate: { type: Number, default: 0 }, // employee's hourly rate at time of OT
    amount: { type: Number, default: 0 }, // hours * hourlyRate * rate
    reason: { type: String, trim: true },
    status: { type: String, enum: OT_STATUS, default: 'pending', index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    paidAt: { type: Date },
    rejectReason: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-compute amount before validate
overtimeRecordSchema.pre('validate', function (next) {
  this.amount = Math.round((this.hours || 0) * (this.hourlyRate || 0) * (this.rate || 1.5));
  next();
});

module.exports = mongoose.model('OvertimeRecord', overtimeRecordSchema);
module.exports.OT_STATUS = OT_STATUS;
