const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Aggregated payroll run for a period. Stores totals + linked payslips.
 * The detailed breakdown lives on Payslip documents.
 */
const payrollSchema = new Schema(
  {
    period: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', required: true, unique: true, index: true },
    totalEmployees: { type: Number, default: 0 },
    processedEmployees: { type: Number, default: 0 },
    totalGross: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalNet: { type: Number, default: 0 },
    totalOvertime: { type: Number, default: 0 },
    totalLoans: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'processing', 'completed', 'approved', 'paid'], default: 'draft', index: true },
    runBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    // Ledger integration
    ledgerRef: { type: String, index: true },
    ledgerPostedAt: { type: Date },
    ledgerPostedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    openingBalance: { type: Number, default: 0 },
    closingBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payroll', payrollSchema);
