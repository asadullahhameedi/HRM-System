const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Loan / salary advance tracking. Active installments are deducted
 * automatically from the monthly payroll until cleared.
 */
const LOAN_TYPES = ['loan', 'advance'];
const LOAN_STATUS = ['active', 'cleared', 'cancelled'];

const loanSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    type: { type: String, enum: LOAN_TYPES, default: 'loan', index: true },
    principal: { type: Number, required: true, min: 0 },
    installmentAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    status: { type: String, enum: LOAN_STATUS, default: 'active', index: true },
    issuedDate: { type: Date, default: Date.now },
    clearedDate: { type: Date },
    description: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

loanSchema.pre('validate', function (next) {
  if (this.isNew) {
    this.remainingAmount = this.principal - this.paidAmount;
  }
  next();
});

module.exports = mongoose.model('Loan', loanSchema);
module.exports.LOAN_STATUS = LOAN_STATUS;
