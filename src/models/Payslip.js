const mongoose = require('mongoose');
const { Schema } = mongoose;

const PAYSLIP_STATUS = ['draft', 'pending', 'approved', 'paid', 'cancelled'];

const componentLineSchema = new Schema(
  {
    name: { type: String, required: true },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const payslipSchema = new Schema(
  {
    payslipNo: { type: String, required: true, unique: true, index: true },
    period: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    salaryStructure: { type: Schema.Types.ObjectId, ref: 'SalaryStructure' },

    // Snapshot of computed values
    basicSalary: { type: Number, default: 0 },
    allowances: [componentLineSchema],
    overtime: { hours: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
    bonuses: [componentLineSchema],
    incentives: [componentLineSchema],
    deductions: [componentLineSchema],
    tax: { percent: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
    absentPenalty: { days: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
    loanInstallment: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    manualAdjustments: { add: { type: Number, default: 0 }, deduct: { type: Number, default: 0 } },

    grossEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },

    // Attendance snapshot
    attendance: {
      presentDays: { type: Number, default: 0 },
      absentDays: { type: Number, default: 0 },
      paidLeaveDays: { type: Number, default: 0 },
      holidays: { type: Number, default: 0 },
    },

    status: { type: String, enum: PAYSLIP_STATUS, default: 'draft', index: true },
    paidAt: { type: Date },

    // Manual override flag
    isManual: { type: Boolean, default: false },
    notes: { type: String },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// One payslip per employee per period
payslipSchema.index({ period: 1, employee: 1 }, { unique: true });

module.exports = mongoose.model('Payslip', payslipSchema);
module.exports.PAYSLIP_STATUS = PAYSLIP_STATUS;
