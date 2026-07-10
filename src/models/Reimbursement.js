const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Employee reimbursements — work-related expenses the employee paid out of
 * pocket and is requesting the company to reimburse (e.g. travel, supplies,
 * training). Approved reimbursements are added to the next payslip's gross
 * earnings as a non-recurring line item.
 */
const REIMBURSEMENT_STATUS = ['pending', 'approved', 'rejected', 'paid'];
const REIMBURSEMENT_TYPES = ['travel', 'meals', 'supplies', 'training', 'medical', 'communication', 'other'];

const reimbursementSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    period: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', index: true }, // period to be paid in (null = next available)
    type: { type: String, enum: REIMBURSEMENT_TYPES, default: 'other' },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'AFN' },
    expenseDate: { type: Date, default: Date.now },
    status: { type: String, enum: REIMBURSEMENT_STATUS, default: 'pending', index: true },
    receiptUrl: { type: String }, // uploaded receipt file
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    paidAt: { type: Date },
    rejectReason: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reimbursement', reimbursementSchema);
module.exports.REIMBURSEMENT_STATUS = REIMBURSEMENT_STATUS;
module.exports.REIMBURSEMENT_TYPES = REIMBURSEMENT_TYPES;
