const mongoose = require('mongoose');
const { Schema } = mongoose;

const ROLES = ['admin', 'finance', 'hr', 'employee', 'professional'];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'employee', index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee' },
    avatar: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'locked'], default: 'active', index: true },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    themePreference: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  },
  { timestamps: true }
);

// Indexes for auth lookups
userSchema.index({ email: 1, status: 1 });

// Never return password in JSON
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
