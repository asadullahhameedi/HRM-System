const { Attendance, Leave, Holiday } = require('../models');
const ApiError = require('../utils/ApiError');
const { startOfDay, endOfDay, diffDays } = require('../utils/date');
const { parseQuery } = require('../utils/pagination');
const settingsService = require('./settings.service');
const baseDefaults = require('../config/defaults');

/**
 * Load attendance + payroll settings from the DB-backed settings service.
 * Falls back to hardcoded defaults if the DB is unavailable.
 */
async function getAttendanceSettings() {
  try {
    const all = await settingsService.loadAll();
    return {
      workingHoursPerDay: Number(all.payroll?.workingHoursPerDay) || Number(all.attendance?.workingHoursPerDay) || baseDefaults.workingHoursPerDay,
      checkInTime: all.attendance?.checkInTime || baseDefaults.checkInTime,
      checkOutTime: all.attendance?.checkOutTime || baseDefaults.checkOutTime,
      lateGraceMinutes: Number(all.attendance?.lateGraceMinutes) || baseDefaults.lateGraceMinutes,
      weekendDays: all.attendance?.weekendDays || [5],
      breakMinutes: Number(all.attendance?.breakMinutes) || 60,
      flexibleHours: all.attendance?.flexibleHours || false,
      autoOvertime: all.attendance?.autoOvertime !== false,
    };
  } catch (e) {
    return {
      workingHoursPerDay: baseDefaults.workingHoursPerDay,
      checkInTime: baseDefaults.checkInTime,
      checkOutTime: baseDefaults.checkOutTime,
      lateGraceMinutes: baseDefaults.lateGraceMinutes,
      weekendDays: [5],
      breakMinutes: 60,
      flexibleHours: false,
      autoOvertime: true,
    };
  }
}

// ---------- Attendance ----------
async function listAttendance(req) {
  const { page, limit, skip, sort } = parseQuery(req, { searchableFields: [] });
  const query = {};
  if (req.query.employee) query.employee = req.query.employee;
  if (req.query.status) query.status = req.query.status;
  if (req.query.from || req.query.to) {
    query.date = {};
    if (req.query.from) query.date.$gte = startOfDay(new Date(req.query.from));
    if (req.query.to) query.date.$lte = endOfDay(new Date(req.query.to));
  }

  const [items, total] = await Promise.all([
    Attendance.find(query)
      .populate('employee', 'employeeId firstName lastName avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Attendance.countDocuments(query),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function recordAttendance(data, createdBy) {
  const date = startOfDay(new Date(data.date));

  // Load attendance settings from DB
  const settings = await getAttendanceSettings();

  // Block attendance on weekends (based on configured weekend days)
  const dayOfWeek = date.getDay();
  if (settings.weekendDays && settings.weekendDays.indexOf(dayOfWeek) !== -1) {
    throw ApiError.badRequest('Attendance cannot be recorded on a weekend (non-working day).');
  }

  // Block attendance on holidays
  const isHoliday = await Holiday.exists({ date: { $gte: date, $lte: endOfDay(date) } });
  if (isHoliday) throw ApiError.badRequest('Attendance cannot be recorded on a holiday.');

  const existing = await Attendance.findOne({ employee: data.employee, date });
  if (existing) throw ApiError.conflict('Attendance already exists for this employee on this date.');

  // Compute work hours + overtime + late based on settings
  let workHours = 0;
  let overtimeHours = 0;
  let lateMinutes = 0;
  if (data.checkIn && data.checkOut) {
    const inT = new Date(data.checkIn);
    const outT = new Date(data.checkOut);
    workHours = Math.max(0, (outT - inT) / (1000 * 60 * 60));

    // Subtract break time if configured
    if (settings.breakMinutes > 0) {
      workHours = Math.max(0, workHours - settings.breakMinutes / 60);
    }

    // Auto-calculate overtime only if enabled in settings
    if (settings.autoOvertime) {
      overtimeHours = Math.max(0, workHours - settings.workingHoursPerDay);
    }

    // Calculate late minutes based on configured check-in time + grace period
    if (!settings.flexibleHours && settings.checkInTime) {
      const [stdH, stdM] = settings.checkInTime.split(':').map(Number);
      const stdCheckIn = new Date(date);
      stdCheckIn.setHours(stdH, stdM, 0, 0);
      const diffMs = inT - stdCheckIn;
      if (diffMs > settings.lateGraceMinutes * 60 * 1000) {
        lateMinutes = Math.round(diffMs / (60 * 1000));
      }
    }
  }

  return Attendance.create({
    ...data,
    date,
    workHours: Math.round(workHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    lateMinutes,
    createdBy,
  });
}

// bulkImportAttendance removed — was exported but never wired to any
// controller/route. If you need bulk attendance import, add a route and
// controller handler that calls Attendance.bulkWrite directly.

// ---------- Leave ----------
async function listLeaves(req) {
  const { page, limit, skip, sort } = parseQuery(req, { searchableFields: ['reason'] });
  const query = {};
  if (req.query.employee) query.employee = req.query.employee;
  if (req.query.status) query.status = req.query.status;
  if (req.query.leaveType) query.leaveType = req.query.leaveType;

  // Employees only see their own leaves
  if (req.user?.role === 'employee' && req.user.employee) {
    query.employee = req.user.employee;
  }

  const [items, total] = await Promise.all([
    Leave.find(query)
      .populate('employee', 'employeeId firstName lastName avatar')
      .populate('leaveType', 'name code isPaid')
      .populate('requestedBy', 'name')
      .populate('reviewedBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Leave.countDocuments(query),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function applyLeave(data, requestedBy) {
  const from = startOfDay(new Date(data.fromDate));
  const to = startOfDay(new Date(data.toDate));
  if (to < from) throw ApiError.badRequest('To date must be on or after from date.');

  const days = diffDays(from, to) + 1;

  // Overlap check
  const overlap = await Leave.exists({
    employee: data.employee,
    status: { $in: ['pending', 'approved'] },
    fromDate: { $lte: to }, toDate: { $gte: from },
  });
  if (overlap) throw ApiError.conflict('An overlapping leave request already exists.');

  return Leave.create({
    ...data,
    fromDate: from,
    toDate: to,
    days,
    requestedBy,
    status: 'pending',
  });
}

async function reviewLeave(id, { status, reviewRemarks }, reviewedBy) {
  const leave = await Leave.findById(id);
  if (!leave) throw ApiError.notFound('Leave request not found.');
  leave.status = status;
  leave.reviewedBy = reviewedBy;
  leave.reviewedAt = new Date();
  if (reviewRemarks !== undefined) leave.reviewRemarks = reviewRemarks;
  await leave.save();
  return leave;
}

async function updateLeave(id, data) {
  const leave = await Leave.findById(id);
  if (!leave) throw ApiError.notFound('Leave request not found.');
  ['employee', 'leaveType'].forEach((f) => { if (data[f] === '') delete data[f]; });
  if (data.fromDate) data.fromDate = startOfDay(new Date(data.fromDate));
  if (data.toDate) data.toDate = startOfDay(new Date(data.toDate));
  if (data.fromDate && data.toDate) {
    data.days = diffDays(data.fromDate, data.toDate) + 1;
  }
  Object.assign(leave, data);
  await leave.save();
  return leave;
}

async function deleteLeave(id) {
  await Leave.findByIdAndDelete(id);
}

// getLeaveBalance removed — was exported but never called. To add leave
// balance display to the employee detail page, query LeaveType + Leave
// aggregate inline (the function's logic is no longer needed here).

// ---------- Holidays ----------
async function listHolidays(req) {
  const { page, limit, skip, sort } = parseQuery(req, { searchableFields: ['name'] });
  const query = {};
  if (req.query.year) {
    const y = parseInt(req.query.year, 10);
    query.date = { $gte: new Date(`${y}-01-01`), $lte: new Date(`${y}-12-31T23:59:59`) };
  }
  const [items, total] = await Promise.all([
    Holiday.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Holiday.countDocuments(query),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function createHoliday(data, createdBy) {
  const date = startOfDay(new Date(data.date));
  return Holiday.create({ ...data, date, createdBy });
}

async function updateHoliday(id, data) {
  const holiday = await Holiday.findById(id);
  if (!holiday) throw ApiError.notFound('Holiday not found.');
  if (data.date) data.date = startOfDay(new Date(data.date));
  // Explicitly handle the isRecurring checkbox: unchecked forms send nothing,
  // so the controller normalizes it to false — make sure the service writes it.
  if (data.isRecurring !== undefined) {
    holiday.isRecurring = data.isRecurring === true || data.isRecurring === 'on' || data.isRecurring === 'true';
  }
  // Map the remaining editable fields explicitly.
  if (data.name !== undefined) holiday.name = data.name;
  if (data.type !== undefined) holiday.type = data.type;
  if (data.description !== undefined) holiday.description = data.description;
  await holiday.save();
  return holiday;
}

async function deleteHoliday(id) {
  await Holiday.findByIdAndDelete(id);
}

// countHolidaysInRange removed — was exported but never called. The
// payroll service counts holidays inline via Holiday.countDocuments.

module.exports = {
  listAttendance,
  recordAttendance,
  listLeaves,
  applyLeave,
  reviewLeave,
  updateLeave,
  deleteLeave,
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
