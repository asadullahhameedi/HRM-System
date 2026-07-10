const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Defines how an employee is paid: basic salary + recurring
 * allowances/bonuses/incentives/deductions + tax policy.
 * One active structure per employee.
 */
const componentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, default: 0 },
    type: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  },
  { _id: false }
);

const salaryStructureSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    basicSalary: { type: Number, required: true, min: 0 },
    allowances: [componentSchema],
    bonuses: [componentSchema],
    incentives: [componentSchema],
    deductions: [componentSchema],
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },
    overtimeEnabled: { type: Boolean, default: true },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Ensure only one active structure per employee
salaryStructureSchema.index(
  { employee: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

module.exports = mongoose.model('SalaryStructure', salaryStructureSchema);
