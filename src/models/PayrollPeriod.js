const mongoose = require('mongoose');
const { Schema } = mongoose;

const PERIOD_STATUS = ['open', 'processing', 'approved', 'paid', 'closed', 'locked'];
const PROCESSING_STATUS = ['not_started', 'in_progress', 'completed', 'failed'];

const payrollPeriodSchema = new Schema(
  {
    // ---- Identity ----
    name: { type: String, required: true, trim: true, index: true }, // e.g. "January 2025"
    payrollCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true, index: true }, // e.g. "PR-2025-01"

    // ---- Period ----
    month: { type: Number, required: true, min: 1, max: 12 },

    // ---- Date range ----
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    paymentDate: { type: Date }, // pay date

    // ---- Status & workflow ----
    status: { type: String, enum: PERIOD_STATUS, default: 'open', index: true },
    processingStatus: { type: String, enum: PROCESSING_STATUS, default: 'not_started' },
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },

    // ---- Workflow actors ----
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lockedAt: { type: Date },
    paidAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // ---- Aggregates (cached for dashboard/list view) ----
    totalEmployees: { type: Number, default: 0 },
    processedEmployees: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },       // sum of basic salaries
    totalEarnings: { type: Number, default: 0 },     // sum of gross earnings
    totalDeductions: { type: Number, default: 0 },
    netPayroll: { type: Number, default: 0 },

    // ---- Misc ----
    remarks: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// One period per payrollCode (if set) and per month/year for monthly payroll
payrollPeriodSchema.index({ month: 1, startDate: 1 }, { unique: true });
// year field — virtual derived from startDate for sort convenience
payrollPeriodSchema.virtual('year').get(function () {
  return this.startDate ? new Date(this.startDate).getFullYear() : null;
});

// Ensure virtuals are serialized
payrollPeriodSchema.set('toJSON', { virtuals: true });
payrollPeriodSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PayrollPeriod', payrollPeriodSchema);
module.exports.PERIOD_STATUS = PERIOD_STATUS;
module.exports.PROCESSING_STATUS = PROCESSING_STATUS;
