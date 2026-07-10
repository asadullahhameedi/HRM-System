const mongoose = require('mongoose');
const { Schema } = mongoose;

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    head: { type: Schema.Types.ObjectId, ref: 'Employee' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

departmentSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

module.exports = mongoose.model('Department', departmentSchema);
