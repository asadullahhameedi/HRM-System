const mongoose = require('mongoose');
const { Schema } = mongoose;

const designationSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Designation', designationSchema);
