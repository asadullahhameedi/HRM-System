const asyncHandler = require('../utils/asyncHandler');
const attendanceService = require('../services/attendance.service');
const auditLog = require('../middleware/audit');
const { paginate } = require('../utils/pagination');
const Employee = require('../models/Employee');

// ---------- Attendance ----------
const index = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } = await attendanceService.listAttendance(req);
  const employees = await Employee.find({ status: 'active' }).select('employeeId firstName lastName').lean();
  // Load holiday dates to disable in the date picker
  const holidays = await require('../models/Holiday').find().select('date name').lean();
  const holidayDates = holidays.map(h => new Date(h.date).toISOString().slice(0, 10));
  res.render('attendance/index', {
    title: 'Attendance',
    records: items,
    employees,
    holidayDates,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const store = asyncHandler(async (req, res, next) => {
  const att = await attendanceService.recordAttendance(req.body, req.user._id);
  await auditLog(req, { action: 'attendance.create', module: 'attendance', target: att._id, description: `Recorded attendance for ${att.date.toDateString()}` });
  req.flash('success', 'Attendance recorded.');
  res.redirect('/attendance');
});

const update = asyncHandler(async (req, res, next) => {
  const Attendance = require('../models/Attendance');
  const att = await Attendance.findById(req.params.id);
  if (!att) { req.flash('error', 'Attendance record not found.'); return res.redirect('/attendance'); }
  // Update fields
  if (req.body.date) att.date = req.body.date;
  if (req.body.status) att.status = req.body.status;
  if (req.body.checkIn !== undefined) att.checkIn = req.body.checkIn || undefined;
  if (req.body.checkOut !== undefined) att.checkOut = req.body.checkOut || undefined;
  if (req.body.overtimeHours !== undefined) att.overtimeHours = Number(req.body.overtimeHours) || 0;
  if (req.body.remarks !== undefined) att.remarks = req.body.remarks;
  // Recalculate work hours
  if (att.checkIn && att.checkOut) {
    att.workHours = Math.round(((att.checkOut - att.checkIn) / (1000 * 60 * 60)) * 100) / 100;
  }
  await att.save();
  await auditLog(req, { action: 'attendance.update', module: 'attendance', target: att._id, description: `Updated attendance for ${att.date.toDateString()}` });
  req.flash('success', 'Attendance updated.');
  res.redirect('/attendance');
});

const destroy = asyncHandler(async (req, res, next) => {
  await require('../models/Attendance').findByIdAndDelete(req.params.id);
  await auditLog(req, { action: 'attendance.delete', module: 'attendance', target: req.params.id, description: 'Deleted attendance record' });
  req.flash('success', 'Attendance record deleted.');
  res.redirect('/attendance');
});

// ---------- Leave ----------
const leaveIndex = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } = await attendanceService.listLeaves(req);
  const employees = await Employee.find({ status: 'active' }).select('employeeId firstName lastName').lean();
  const leaveTypes = await require('../models/LeaveType').find({ status: 'active' }).lean();
  res.render('leave/index', {
    title: 'Leave Requests',
    leaves: items,
    employees,
    leaveTypes,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const leaveStore = asyncHandler(async (req, res, next) => {
  const leave = await attendanceService.applyLeave(req.body, req.user._id);
  await auditLog(req, { action: 'leave.create', module: 'leave', target: leave._id, description: `Applied leave for ${leave.days} day(s)` });
  req.flash('success', 'Leave request submitted.');
  res.redirect('/leave');
});

const leaveReview = asyncHandler(async (req, res, next) => {
  const leave = await attendanceService.reviewLeave(req.params.id, req.body, req.user._id);
  await auditLog(req, { action: 'leave.review', module: 'leave', target: leave._id, description: `Leave ${leave.status}` });
  req.flash('success', `Leave ${leave.status}.`);
  res.redirect('/leave');
});

const leaveUpdate = asyncHandler(async (req, res, next) => {
  ['employee', 'leaveType'].forEach((f) => { if (req.body[f] === '') delete req.body[f]; });
  if (req.body.fromDate === '') delete req.body.fromDate;
  if (req.body.toDate === '') delete req.body.toDate;
  const leave = await attendanceService.updateLeave(req.params.id, req.body);
  await auditLog(req, { action: 'leave.update', module: 'leave', target: leave._id, description: `Updated leave request` });
  req.flash('success', 'Leave updated.');
  res.redirect('/leave');
});

const leaveDestroy = asyncHandler(async (req, res, next) => {
  await attendanceService.deleteLeave(req.params.id);
  await auditLog(req, { action: 'leave.delete', module: 'leave', target: req.params.id, description: 'Deleted leave request' });
  req.flash('success', 'Leave deleted.');
  res.redirect('/leave');
});


// ---------- Holidays ----------
const holidayIndex = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } = await attendanceService.listHolidays(req);
  res.render('holidays/index', {
    title: 'Holidays',
    holidays: items,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const holidayStore = asyncHandler(async (req, res, next) => {
  const h = await attendanceService.createHoliday(req.body, req.user._id);
  await auditLog(req, { action: 'holiday.create', module: 'holiday', target: h._id, description: `Created holiday ${h.name}` });
  req.flash('success', 'Holiday added.');
  res.redirect('/holidays');
});

const holidayUpdate = asyncHandler(async (req, res, next) => {
  if (req.body.isRecurring === undefined) req.body.isRecurring = false;
  const h = await attendanceService.updateHoliday(req.params.id, req.body);
  await auditLog(req, { action: 'holiday.update', module: 'holiday', target: h._id, description: `Updated holiday ${h.name}` });
  req.flash('success', 'Holiday updated.');
  res.redirect('/holidays');
});

const holidayDestroy = asyncHandler(async (req, res, next) => {
  await attendanceService.deleteHoliday(req.params.id);
  await auditLog(req, { action: 'holiday.delete', module: 'holiday', target: req.params.id, description: 'Deleted holiday' });
  req.flash('success', 'Holiday deleted.');
  res.redirect('/holidays');
});

module.exports = {
  index,
  store,
  update,
  destroy,
  leaveIndex,
  leaveStore,
  leaveReview,
  leaveUpdate,
  leaveDestroy,
  holidayIndex,
  holidayStore,
  holidayUpdate,
  holidayDestroy,
};
