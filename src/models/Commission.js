const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Sales / performance commissions awarded to an employee. Approved
 * commissions are paid out in the next payroll period as a bonus line
 * item on the payslip.
 */
const COMMISSION_STATUS = ['pending', 'approved', 'rejected', 'paid'];

const commissionSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    period: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', index: true }, // payout period (null = next available)
    title: { type: String, required: true, trim: true }, // e.g. "Q1 Sales Commission"
    description: { type: String, trim: true },
    // Either a flat amount OR a percentage of a base (e.g. sales amount).
    amountType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
    amount: { type: Number, required: true, min: 0 }, // fixed amount or percentage value
    baseAmount: { type: Number, default: 0 }, // for percentage: the sales/contract amount
    computedAmount: { type: Number, default: 0 }, // calculated payout (fixed or % of base)
    currency: { type: String, default: 'AFN' },
    status: { type: String, enum: COMMISSION_STATUS, default: 'pending', index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    paidAt: { type: Date },
    rejectReason: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-compute computedAmount before validate
commissionSchema.pre('validate', function (next) {
  if (this.amountType === 'percentage' && this.baseAmount) {
    this.computedAmount = Math.round((this.baseAmount * this.amount) / 100);
  } else {
    this.computedAmount = this.amount;
  }
  next();
});

module.exports = mongoose.model('Commission', commissionSchema);
module.exports.COMMISSION_STATUS = COMMISSION_STATUS;
