const mongoose = require('mongoose');
const { Schema } = mongoose;

const ATTENDANCE_STATUS = ['present', 'absent', 'late', 'half-day', 'leave', 'holiday'];

const attendanceSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: Date, required: true, index: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: { type: String, enum: ATTENDANCE_STATUS, default: 'present', index: true },
    workHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    remarks: { type: String, trim: true },
    source: { type: String, enum: ['manual', 'system', 'import'], default: 'manual' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// One record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
module.exports.ATTENDANCE_STATUS = ATTENDANCE_STATUS;
