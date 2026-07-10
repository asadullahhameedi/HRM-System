const mongoose = require('mongoose');
const { Schema } = mongoose;

const GENDER = ['male', 'female', 'other'];
const MARITAL = ['single', 'married', 'divorced', 'widowed'];
const EMPLOYMENT = ['full-time', 'part-time', 'contract', 'intern'];
const STATUS = ['active', 'inactive', 'terminated', 'resigned'];

const documentSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const employeeSchema = new Schema(
  {
    employeeId: { type: String, required: true, unique: true, index: true, uppercase: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    gender: { type: String, enum: GENDER },
    dateOfBirth: { type: Date },
    maritalStatus: { type: String, enum: MARITAL },
    nationality: { type: String, default: 'Afghan' },
    avatar: { type: String },

    // Address
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true },

    // Employment
    department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    designation: { type: Schema.Types.ObjectId, ref: 'Designation', index: true },
    employmentType: { type: String, enum: EMPLOYMENT, default: 'full-time' },
    status: { type: String, enum: STATUS, default: 'active', index: true },
    joinDate: { type: Date, default: Date.now },
    exitDate: { type: Date },

    // Emergency contact
    emergencyName: { type: String, trim: true },
    emergencyPhone: { type: String, trim: true },
    emergencyRelation: { type: String, trim: true },

    // Bank
    bankName: { type: String, trim: true },
    bankAccount: { type: String, trim: true },

    // Documents
    documents: [documentSchema],

    // System link
    user: { type: Schema.Types.ObjectId, ref: 'User' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Text + compound indexes for search performance
employeeSchema.index({
  employeeId: 'text',
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  phone: 'text',
});
employeeSchema.index({ department: 1, status: 1 });
// Note: designation index is already declared via `index: true` on the field

employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('Employee', employeeSchema);
module.exports.STATUSES = STATUS;
module.exports.EMPLOYMENT_TYPES = EMPLOYMENT;
