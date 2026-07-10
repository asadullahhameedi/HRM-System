const mongoose = require('mongoose');
const { Schema } = mongoose;

const holidaySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    type: { type: String, enum: ['national', 'religious', 'company', 'other'], default: 'national' },
    isRecurring: { type: Boolean, default: false }, // repeats yearly
    description: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Note: date index is already declared via `index: true` on the field

module.exports = mongoose.model('Holiday', holidaySchema);
