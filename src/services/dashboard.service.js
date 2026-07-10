const { Employee, Department, Attendance, Leave, Payslip, PayrollPeriod, Holiday, AuditLog, Task, Loan } = require('../models');
const { startOfMonth, endOfMonth } = require('../utils/date');

async function getOverview() {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const todayStart = new Date(today); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999);

  const [
    totalEmployees, activeEmployees, newThisMonth, totalDepartments,
    presentToday, onLeaveToday, pendingLeaves, pendingTasks, pendingLoans,
  ] = await Promise.all([
    Employee.countDocuments(),
    Employee.countDocuments({ status: 'active' }),
    Employee.countDocuments({ joinDate: { $gte: monthStart, $lte: monthEnd } }),
    Department.countDocuments({ status: 'active' }),
    Attendance.countDocuments({ date: { $gte: todayStart, $lte: todayEnd }, status: { $in: ['present', 'late'] } }),
    Leave.countDocuments({ status: 'approved', fromDate: { $lte: today }, toDate: { $gte: today } }),
    Leave.countDocuments({ status: 'pending' }),
    Task.countDocuments({ status: { $in: ['todo', 'in_progress', 'review'] } }),
    Loan.countDocuments({ status: 'active' }),
  ]);

  return { totalEmployees, activeEmployees, inactiveEmployees: totalEmployees - activeEmployees, newThisMonth, totalDepartments, presentToday, onLeaveToday, pendingLeaves, pendingTasks, pendingLoans };
}

async function getHeadcountByDepartment() {
  return Employee.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
    { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
    { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, department: { $ifNull: ['$dept.name', 'Unassigned'] }, count: 1 } },
    { $sort: { count: -1 } },
  ]);
}

async function getAttendanceTrend(days = 7) {
  const start = new Date(); start.setDate(start.getDate() - (days - 1)); start.setHours(0, 0, 0, 0);
  return Attendance.aggregate([
    { $match: { date: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } }, leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]);
}

async function getPayrollTrend(months = 6) {
  const now = new Date();
  const periods = await PayrollPeriod.find({ $or: [{ year: now.getFullYear(), month: { $lte: now.getMonth() + 1 } }, { year: now.getFullYear() - 1 }] }).sort({ year: -1, month: -1 }).limit(months).lean();
  const ids = periods.map((p) => p._id);
  const sums = await Payslip.aggregate([
    { $match: { period: { $in: ids }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$period', net: { $sum: '$netPay' }, gross: { $sum: '$grossEarnings' } } },
  ]);
  const map = new Map(sums.map((s) => [String(s._id), s]));
  return periods.map((p) => ({ label: `${p.month}/${p.year}`, net: map.get(String(p._id))?.net || 0, gross: map.get(String(p._id))?.gross || 0 })).reverse();
}

async function getUpcomingHolidays(limit = 5) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Holiday.find({ date: { $gte: today } }).sort({ date: 1 }).limit(limit).lean();
}

async function getRecentActivity(limit = 8) {
  return AuditLog.find().sort({ createdAt: -1 }).limit(limit).populate('actor', 'name email').lean();
}

async function getPendingApprovals() {
  const [leaves, tasks] = await Promise.all([Leave.countDocuments({ status: 'pending' }), Task.countDocuments({ status: 'review' })]);
  return { leaves, tasks, total: leaves + tasks };
}

async function getFinancialSummary() {
  // Returns the system's payroll-based financial summary. (The legacy
  // LedgerEntry model was removed; this is the canonical replacement.)
  const payrollResult = await Payslip.aggregate([
    { $match: { status: { $in: ['approved', 'paid'] } } },
    { $group: { _id: null, totalGross: { $sum: '$grossEarnings' }, totalNet: { $sum: '$netPay' }, totalDeductions: { $sum: '$totalDeductions' } } },
  ]);
  const data = payrollResult[0] || { totalGross: 0, totalNet: 0, totalDeductions: 0 };
  return {
    income: data.totalGross,
    expense: data.totalDeductions,
    balance: data.totalNet,
  };
}

// Removed (never called by any controller): getEmployeeGrowth, getUpcomingBirthdays,
// getWorkAnniversaries, getNewHires, getTasksSummary, getRecentPayroll. If you
// need them later, restore from git history and wire them into a controller.

module.exports = {
  getOverview,
  getHeadcountByDepartment,
  getAttendanceTrend,
  getPayrollTrend,
  getUpcomingHolidays,
  getRecentActivity,
  getPendingApprovals,
  getFinancialSummary,
};
