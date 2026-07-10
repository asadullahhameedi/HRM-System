const asyncHandler = require('../utils/asyncHandler');
const { Payslip, PayrollPeriod, Employee, Attendance, Leave, LeaveType, Loan, SalaryStructure, Department, AuditLog, User } = require('../models');

/**
 * Reports controller — enterprise reporting module.
 *
 * Architecture: Database → Mongoose aggregations → Controller → EJS view → Chart.js + Export
 *
 * Every report:
 *   - Queries real database data (no static/demo data)
 *   - Supports date-range + department + employee + status filters
 *   - Offers Excel/CSV export via ?format=xlsx|csv
 *   - Includes interactive Chart.js visualizations
 *   - Has summary KPI cards
 *
 * RBAC:
 *   - admin/hr/finance → all reports
 *   - employee → only their own data (filtered by req.user.employee)
 */

// ---- Shared helpers ----
function parseFilters(req) {
  const from = req.query.from ? new Date(req.query.from) : new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
  const to = req.query.to ? new Date(req.query.to + 'T23:59:59') : new Date();
  const department = req.query.department || '';
  const period = req.query.period || '';
  const employee = req.query.employee || '';
  const status = req.query.status || '';
  return { from, to, department, period, employee, status };
}

function exportTabular(res, { filename, format, columns, rows }) {
  const XLSX = require('xlsx');
  const data = rows.map((r) => {
    const out = {};
    columns.forEach((c) => {
      const colKey = c.colKey || c.header;
      let val = r[c.key];
      if (c.format) val = c.format(val);
      out[colKey] = val;
    });
    return out;
  });
  if (format === 'csv') {
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  return res.send(buffer);
}

// Apply employee-level RBAC: if user is 'employee', filter to their own records
function applyEmployeeScope(req, query) {
  if (req.user?.role === 'employee' && req.user.employee) {
    query.employee = req.user.employee;
  }
  return query;
}

// ---- Report categories for the dashboard ----
const REPORT_CATEGORIES = [
  {
    name: 'Employee Reports', icon: 'users', color: 'brand',
    reports: [
      { id: 'employee', name: 'Employee List', icon: 'users', desc: 'Headcount by department, status, type' },
      { id: 'attendance', name: 'Attendance Report', icon: 'fingerprint', desc: 'Daily attendance status breakdown' },
      { id: 'overtime', name: 'Overtime Report', icon: 'clock', desc: 'Overtime hours per employee' },
      { id: 'leave', name: 'Leave Report', icon: 'calendar-check', desc: 'Leave applications and approvals' },
    ],
  },
  {
    name: 'Payroll Reports', icon: 'file-invoice-dollar', color: 'emerald',
    reports: [
      { id: 'payroll-summary', name: 'Payroll Summary', icon: 'chart-column', desc: 'Monthly gross/net/deductions overview' },
      { id: 'payroll-register', name: 'Payroll Register', icon: 'list-alt', desc: 'Detailed payslip listing per period' },
      { id: 'salary', name: 'Salary Report', icon: 'money-bill-trend-up', desc: 'Active salary structures by employee' },
      { id: 'employee-payroll', name: 'Employee Payroll', icon: 'user-tag', desc: 'Per-employee payroll history' },
      { id: 'deduction', name: 'Deduction Report', icon: 'arrow-trend-down', desc: 'All deductions across a period' },
      { id: 'tax', name: 'Tax Report', icon: 'percent', desc: 'Tax collected per period' },
      { id: 'bonus', name: 'Bonus Report', icon: 'gift', desc: 'All bonuses paid across periods' },
    ],
  },
  {
    name: 'Department Reports', icon: 'sitemap', color: 'amber',
    reports: [
      { id: 'department', name: 'Department Payroll', icon: 'sitemap', desc: 'Headcount and payroll by department' },
      { id: 'loan', name: 'Loan Report', icon: 'hand-holding-dollar', desc: 'Outstanding loans & advances' },
    ],
  },
  {
    name: 'System Reports', icon: 'shield-halved', color: 'sky',
    reports: [
      { id: 'user-activity', name: 'User Activity', icon: 'shield-halved', desc: 'Audit log and user activity history' },
    ],
  },
];

// ============ 1. Report Dashboard ============
const index = asyncHandler(async (req, res) => {
  // Real KPI aggregations from the database
  const [
    totalEmployees, activeEmployees, totalDepartments,
    totalPayslips, totalGrossYr, totalNetYr, totalDeductionsYr,
    totalTaxYr, activeLoans, pendingLeaves, presentToday, absentToday,
  ] = await Promise.all([
    Employee.countDocuments(),
    Employee.countDocuments({ status: 'active' }),
    Department.countDocuments({ status: 'active' }),
    Payslip.countDocuments({ status: { $ne: 'cancelled' } }),
    Payslip.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, v: { $sum: '$grossEarnings' } } }]),
    Payslip.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, v: { $sum: '$netPay' } } }]),
    Payslip.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, v: { $sum: '$totalDeductions' } } }]),
    Payslip.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, v: { $sum: '$tax.amount' } } }]),
    Loan.countDocuments({ status: 'active' }),
    Leave.countDocuments({ status: 'pending' }),
    Attendance.countDocuments({ date: { $gte: new Date(new Date().setHours(0,0,0,0)), $lte: new Date(new Date().setHours(23,59,59,999)) }, status: { $in: ['present', 'late'] } }),
    Attendance.countDocuments({ date: { $gte: new Date(new Date().setHours(0,0,0,0)), $lte: new Date(new Date().setHours(23,59,59,999)) }, status: 'absent' }),
  ]);

  // Monthly payroll trend (last 6 months) for the chart
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const periods = await PayrollPeriod.find({ startDate: { $gte: sixMonthsAgo } }).sort({ startDate: 1 }).lean();
  const periodIds = periods.map((p) => p._id);
  const monthlyAgg = await Payslip.aggregate([
    { $match: { period: { $in: periodIds }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$period', gross: { $sum: '$grossEarnings' }, net: { $sum: '$netPay' }, deductions: { $sum: '$totalDeductions' } } },
  ]);
  const monthlyMap = new Map(monthlyAgg.map((m) => [String(m._id), m]));
  const monthlyTrend = periods.map((p) => ({
    label: p.name,
    gross: monthlyMap.get(String(p._id))?.gross || 0,
    net: monthlyMap.get(String(p._id))?.net || 0,
    deductions: monthlyMap.get(String(p._id))?.deductions || 0,
  }));

  // Department headcount for the chart
  const deptHeadcount = await Employee.aggregate([
    { $match: { status: 'active' } },
    { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } },
    { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
    { $group: { _id: '$dept.name', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.render('reports/index', {
    title: 'Reports & Analytics',
    categories: REPORT_CATEGORIES,
    kpis: {
      totalEmployees, activeEmployees, totalDepartments,
      totalPayslips, totalGrossYr: totalGrossYr[0]?.v || 0, totalNetYr: totalNetYr[0]?.v || 0,
      totalDeductionsYr: totalDeductionsYr[0]?.v || 0, totalTaxYr: totalTaxYr[0]?.v || 0,
      activeLoans, pendingLeaves, presentToday, absentToday,
    },
    monthlyTrend,
    deptHeadcount,
  });
});

// ============ 2. Payroll Summary ============
const payrollSummary = asyncHandler(async (req, res) => {
  const filters = parseFilters(req);
  const periods = await PayrollPeriod.find({ startDate: { $gte: filters.from, $lte: filters.to } }).sort({ startDate: 1 }).lean();
  const periodIds = periods.map((p) => p._id);
  const aggregation = await Payslip.aggregate([
    { $match: { period: { $in: periodIds }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$period', gross: { $sum: '$grossEarnings' }, net: { $sum: '$netPay' }, deductions: { $sum: '$totalDeductions' }, tax: { $sum: '$tax.amount' }, count: { $sum: 1 } } },
  ]);
  const map = new Map(aggregation.map((a) => [String(a._id), a]));
  const rows = periods.map((p) => ({
    period: p, gross: map.get(String(p._id))?.gross || 0, net: map.get(String(p._id))?.net || 0,
    deductions: map.get(String(p._id))?.deductions || 0, tax: map.get(String(p._id))?.tax || 0, count: map.get(String(p._id))?.count || 0,
  }));
  const totals = rows.reduce((acc, r) => ({ gross: acc.gross + r.gross, net: acc.net + r.net, deductions: acc.deductions + r.deductions, tax: acc.tax + r.tax, count: acc.count + r.count }), { gross: 0, net: 0, deductions: 0, tax: 0, count: 0 });

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'payroll-summary', format: req.query.format, columns: [
      { key: 'period', header: 'Period', format: (v) => v.name },
      { key: 'count', header: 'Payslips' }, { key: 'gross', header: 'Gross' },
      { key: 'deductions', header: 'Deductions' }, { key: 'tax', header: 'Tax' }, { key: 'net', header: 'Net' },
    ], rows: rows.concat([{ period: { name: 'TOTAL' }, ...totals }]) });
  }
  const departments = await Department.find().lean();
  res.render('reports/payroll-summary', { title: 'Payroll Summary', rows, totals, filters, departments });
});

// ============ 3. Payroll Register ============
const payrollRegister = asyncHandler(async (req, res) => {
  const filters = parseFilters(req);
  const match = { status: { $ne: 'cancelled' } };
  if (filters.period) match.period = filters.period;
  else { const ps = await PayrollPeriod.find({ startDate: { $gte: filters.from, $lte: filters.to } }).select('_id').lean(); match.period = { $in: ps.map((p) => p._id) }; }
  let payslips = await Payslip.find(match).populate('employee', 'employeeId firstName lastName department').populate({ path: 'employee', populate: { path: 'department', select: 'name' } }).populate('period', 'name month year').sort({ 'employee.employeeId': 1 }).lean();
  if (filters.department) payslips = payslips.filter((p) => String(p.employee?.department?._id || p.employee?.department) === filters.department);

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'payroll-register', format: req.query.format, columns: [
      { key: 'payslipNo', header: 'Payslip No' }, { key: 'period', header: 'Period', format: (v) => v?.name || '' },
      { key: 'employee', header: 'Employee', format: (v) => v ? `${v.firstName} ${v.lastName}` : '', colKey: 'name' },
      { key: 'employee', header: 'Emp ID', format: (v) => v?.employeeId || '', colKey: 'employeeId' },
      { key: 'basicSalary', header: 'Basic' }, { key: 'grossEarnings', header: 'Gross' },
      { key: 'totalDeductions', header: 'Deductions' }, { key: 'netPay', header: 'Net' }, { key: 'status', header: 'Status' },
    ], rows: payslips });
  }
  const departments = await Department.find().lean();
  const periods = await PayrollPeriod.find().sort({ startDate: -1 }).limit(12).lean();
  res.render('reports/payroll-register', { title: 'Payroll Register', payslips, filters, departments, periods });
});

// ============ 4. Salary Report ============
const salaryReport = asyncHandler(async (req, res) => {
  const match = { status: 'active' };
  if (req.query.department) match.department = req.query.department;
  const structures = await SalaryStructure.find(match).populate('employee', 'employeeId firstName lastName department').populate({ path: 'employee', populate: { path: 'department', select: 'name' } }).sort({ 'employee.employeeId': 1 }).lean();

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'salary-report', format: req.query.format, columns: [
      { key: 'employee', header: 'Emp ID', format: (v) => v?.employeeId || '' },
      { key: 'employee', header: 'Employee', format: (v) => v ? `${v.firstName} ${v.lastName}` : '', colKey: 'name' },
      { key: 'employee', header: 'Dept', format: (v) => v?.department?.name || '', colKey: 'department' },
      { key: 'basicSalary', header: 'Basic' }, { key: 'allowances', header: 'Allowances', format: (v) => (v || []).reduce((s, a) => s + a.amount, 0) },
      { key: 'bonuses', header: 'Bonuses', format: (v) => (v || []).reduce((s, a) => s + a.amount, 0) },
      { key: 'deductions', header: 'Deductions', format: (v) => (v || []).reduce((s, a) => s + a.amount, 0) }, { key: 'taxPercent', header: 'Tax %' },
    ], rows: structures });
  }
  const departments = await Department.find().lean();
  const totals = { basic: structures.reduce((s, x) => s + x.basicSalary, 0), allowances: structures.reduce((s, x) => s + (x.allowances || []).reduce((a, b) => a + b.amount, 0), 0), bonuses: structures.reduce((s, x) => s + (x.bonuses || []).reduce((a, b) => a + b.amount, 0), 0), deductions: structures.reduce((s, x) => s + (x.deductions || []).reduce((a, b) => a + b.amount, 0), 0) };
  res.render('reports/salary', { title: 'Salary Report', structures, filters: { department: req.query.department || '' }, departments, totals });
});

// ============ 5. Employee Report ============
const employeeReport = asyncHandler(async (req, res) => {
  const match = {};
  if (req.query.department) match.department = req.query.department;
  if (req.query.status) match.status = req.query.status;
  if (req.query.employmentType) match.employmentType = req.query.employmentType;
  const employees = await Employee.find(match).populate('department', 'name').populate('designation', 'name').sort({ employeeId: 1 }).lean();
  const byDept = await Employee.aggregate([{ $match: match.department ? match : {} }, { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } }, { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } }, { $group: { _id: '$dept.name', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'employee-report', format: req.query.format, columns: [
      { key: 'employeeId', header: 'Emp ID' }, { key: 'firstName', header: 'First' }, { key: 'lastName', header: 'Last' },
      { key: 'department', header: 'Dept', format: (v) => v?.name || '' }, { key: 'designation', header: 'Designation', format: (v) => v?.name || '' },
      { key: 'employmentType', header: 'Type' }, { key: 'status', header: 'Status' }, { key: 'joinDate', header: 'Joined', format: (v) => v ? new Date(v).toLocaleDateString() : '' },
      { key: 'email', header: 'Email' }, { key: 'phone', header: 'Phone' },
    ], rows: employees });
  }
  const departments = await Department.find().lean();
  res.render('reports/employee', { title: 'Employee Report', employees, byDept, filters: req.query, departments });
});

// ============ 6. Attendance Report ============
const attendanceReport = asyncHandler(async (req, res) => {
  const filters = parseFilters(req);
  const match = { date: { $gte: filters.from, $lte: filters.to } };
  applyEmployeeScope(req, match);
  if (filters.department) { const emps = await Employee.find({ department: filters.department }).select('_id').lean(); match.employee = { $in: emps.map((e) => e._id) }; }
  if (filters.status) match.status = filters.status;
  const records = await Attendance.find(match).populate('employee', 'employeeId firstName lastName').sort({ date: -1, 'employee.employeeId': 1 }).limit(1000).lean();
  const byStatus = await Attendance.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 }, otHours: { $sum: '$overtimeHours' } } }]);

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'attendance-report', format: req.query.format, columns: [
      { key: 'date', header: 'Date', format: (v) => new Date(v).toLocaleDateString() },
      { key: 'employee', header: 'Emp ID', format: (v) => v?.employeeId || '' },
      { key: 'employee', header: 'Employee', format: (v) => v ? `${v.firstName} ${v.lastName}` : '', colKey: 'name' },
      { key: 'status', header: 'Status' }, { key: 'workHours', header: 'Hrs' }, { key: 'overtimeHours', header: 'OT' }, { key: 'lateMinutes', header: 'Late' },
    ], rows: records });
  }
  const departments = await Department.find().lean();
  res.render('reports/attendance', { title: 'Attendance Report', records, byStatus, filters, departments });
});

// ============ 7. Overtime Report ============
const overtimeReport = asyncHandler(async (req, res) => {
  const filters = parseFilters(req);
  const match = { date: { $gte: filters.from, $lte: filters.to }, overtimeHours: { $gt: 0 } };
  applyEmployeeScope(req, match);
  if (filters.department) { const emps = await Employee.find({ department: filters.department }).select('_id').lean(); match.employee = { $in: emps.map((e) => e._id) }; }
  const records = await Attendance.find(match).populate('employee', 'employeeId firstName lastName department').populate({ path: 'employee', populate: { path: 'department', select: 'name' } }).sort({ date: -1 }).limit(1000).lean();
  const byEmployee = await Attendance.aggregate([{ $match: match }, { $group: { _id: '$employee', totalHours: { $sum: '$overtimeHours' }, days: { $sum: 1 } } }, { $sort: { totalHours: -1 } }, { $limit: 20 }]);
  const empIds = byEmployee.map((b) => b._id); const emps = await Employee.find({ _id: { $in: empIds } }).select('employeeId firstName lastName').lean();
  const empMap = new Map(emps.map((e) => [String(e._id), e])); const topOt = byEmployee.map((b) => ({ ...b, employee: empMap.get(String(b._id)) }));

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'overtime-report', format: req.query.format, columns: [
      { key: 'date', header: 'Date', format: (v) => new Date(v).toLocaleDateString() },
      { key: 'employee', header: 'Employee', format: (v) => v ? `${v.firstName} ${v.lastName}` : '' },
      { key: 'overtimeHours', header: 'OT Hrs' }, { key: 'workHours', header: 'Work Hrs' },
    ], rows: records });
  }
  const departments = await Department.find().lean();
  res.render('reports/overtime', { title: 'Overtime Report', records, topOt, filters, departments });
});

// ============ 8. Leave Report ============
const leaveReport = asyncHandler(async (req, res) => {
  const filters = parseFilters(req);
  const match = { fromDate: { $gte: filters.from }, toDate: { $lte: filters.to } };
  applyEmployeeScope(req, match);
  if (filters.department) { const emps = await Employee.find({ department: filters.department }).select('_id').lean(); match.employee = { $in: emps.map((e) => e._id) }; }
  if (filters.status) match.status = filters.status;
  const leaves = await Leave.find(match).populate('employee', 'employeeId firstName lastName').populate('leaveType', 'name code').sort({ fromDate: -1 }).lean();
  const byStatus = await Leave.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 }, days: { $sum: '$days' } } }]);
  const byType = await Leave.aggregate([{ $match: match }, { $lookup: { from: 'leavetypes', localField: 'leaveType', foreignField: '_id', as: 'lt' } }, { $unwind: '$lt' }, { $group: { _id: '$lt.name', count: { $sum: 1 }, days: { $sum: '$days' } } }]);

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'leave-report', format: req.query.format, columns: [
      { key: 'employee', header: 'Employee', format: (v) => v ? `${v.firstName} ${v.lastName}` : '' },
      { key: 'leaveType', header: 'Type', format: (v) => v?.name || '' },
      { key: 'fromDate', header: 'From', format: (v) => new Date(v).toLocaleDateString() },
      { key: 'toDate', header: 'To', format: (v) => new Date(v).toLocaleDateString() },
      { key: 'days', header: 'Days' }, { key: 'status', header: 'Status' }, { key: 'reason', header: 'Reason' },
    ], rows: leaves });
  }
  const departments = await Department.find().lean();
  res.render('reports/leave', { title: 'Leave Report', leaves, byStatus, byType, filters, departments });
});

// ============ 9. Deduction Report ============
const deductionReport = asyncHandler(async (req, res) => {
  const filters = parseFilters(req);
  const match = { status: { $ne: 'cancelled' } };
  if (filters.period) match.period = filters.period;
  else { const ps = await PayrollPeriod.find({ startDate: { $gte: filters.from, $lte: filters.to } }).select('_id').lean(); match.period = { $in: ps.map((p) => p._id) }; }
  const payslips = await Payslip.find(match).populate('employee', 'employeeId firstName lastName').populate('period', 'name').lean();
  const rows = [];
  payslips.forEach((p) => {
    p.deductions.forEach((d) => rows.push({ payslipNo: p.payslipNo, period: p.period, employee: p.employee, name: d.name, amount: d.amount, category: 'Custom' }));
    if (p.tax.amount) rows.push({ payslipNo: p.payslipNo, period: p.period, employee: p.employee, name: `Tax (${p.tax.percent}%)`, amount: p.tax.amount, category: 'Tax' });
    if (p.absentPenalty.amount) rows.push({ payslipNo: p.payslipNo, period: p.period, employee: p.employee, name: `Absent Penalty (${p.absentPenalty.days}d)`, amount: p.absentPenalty.amount, category: 'Absence' });
    if (p.loanInstallment) rows.push({ payslipNo: p.payslipNo, period: p.period, employee: p.employee, name: 'Loan Installment', amount: p.loanInstallment, category: 'Loan' });
    if (p.advance) rows.push({ payslipNo: p.payslipNo, period: p.period, employee: p.employee, name: 'Salary Advance', amount: p.advance, category: 'Advance' });
  });
  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'deduction-report', format: req.query.format, columns: [
      { key: 'payslipNo', header: 'Payslip' }, { key: 'period', header: 'Period', format: (v) => v?.name || '' },
      { key: 'employee', header: 'Employee', format: (v) => v ? `${v.firstName} ${v.lastName}` : '' },
      { key: 'name', header: 'Deduction' }, { key: 'category', header: 'Category' }, { key: 'amount', header: 'Amount' },
    ], rows });
  }
  const departments = await Department.find().lean(); const periods = await PayrollPeriod.find().sort({ startDate: -1 }).limit(12).lean();
  const totalDeductions = rows.reduce((s, r) => s + r.amount, 0);
  res.render('reports/deduction', { title: 'Deduction Report', rows, totalDeductions, filters, departments, periods });
});

// ============ 10. Loan Report ============
const loanReport = asyncHandler(async (req, res) => {
  const match = {};
  if (req.query.status) match.status = req.query.status;
  if (req.query.type) match.type = req.query.type;
  if (req.query.department) { const emps = await Employee.find({ department: req.query.department }).select('_id').lean(); match.employee = { $in: emps.map((e) => e._id) }; }
  const loans = await Loan.find(match).populate('employee', 'employeeId firstName lastName department').populate({ path: 'employee', populate: { path: 'department', select: 'name' } }).sort({ createdAt: -1 }).lean();
  const totals = { principal: loans.reduce((s, l) => s + l.principal, 0), paid: loans.reduce((s, l) => s + l.paidAmount, 0), remaining: loans.reduce((s, l) => s + l.remainingAmount, 0), active: loans.filter((l) => l.status === 'active').length };

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'loan-report', format: req.query.format, columns: [
      { key: 'employee', header: 'Emp ID', format: (v) => v?.employeeId || '' },
      { key: 'employee', header: 'Employee', format: (v) => v ? `${v.firstName} ${v.lastName}` : '' },
      { key: 'type', header: 'Type' }, { key: 'principal', header: 'Principal' }, { key: 'paidAmount', header: 'Paid' },
      { key: 'remainingAmount', header: 'Remaining' }, { key: 'status', header: 'Status' },
    ], rows: loans });
  }
  const departments = await Department.find().lean();
  res.render('reports/loan', { title: 'Loan Report', loans, totals, filters: req.query, departments });
});

// ============ 11. Tax Report ============
const taxReport = asyncHandler(async (req, res) => {
  const filters = parseFilters(req);
  const match = { status: { $ne: 'cancelled' }, 'tax.amount': { $gt: 0 } };
  if (filters.period) match.period = filters.period;
  else { const ps = await PayrollPeriod.find({ startDate: { $gte: filters.from, $lte: filters.to } }).select('_id').lean(); match.period = { $in: ps.map((p) => p._id) }; }
  const payslips = await Payslip.find(match).populate('employee', 'employeeId firstName lastName').populate('period', 'name').sort({ 'employee.employeeId': 1 }).lean();
  const byPeriod = await Payslip.aggregate([{ $match: match }, { $group: { _id: '$period', tax: { $sum: '$tax.amount' }, gross: { $sum: '$grossEarnings' }, count: { $sum: 1 } } }]);
  const totalTax = payslips.reduce((s, p) => s + (p.tax.amount || 0), 0);

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'tax-report', format: req.query.format, columns: [
      { key: 'payslipNo', header: 'Payslip' }, { key: 'period', header: 'Period', format: (v) => v?.name || '' },
      { key: 'employee', header: 'Employee', format: (v) => v ? `${v.firstName} ${v.lastName}` : '' },
      { key: 'grossEarnings', header: 'Gross' }, { key: 'tax', header: 'Tax %', format: (v) => v?.percent || 0, colKey: 'taxPercent' },
      { key: 'tax', header: 'Tax Amount', format: (v) => v?.amount || 0, colKey: 'taxAmount' },
    ], rows: payslips });
  }
  const departments = await Department.find().lean(); const periods = await PayrollPeriod.find().sort({ startDate: -1 }).limit(12).lean();
  res.render('reports/tax', { title: 'Tax Report', payslips, byPeriod, totalTax, filters, departments, periods });
});

// ============ 12. Bonus Report ============
const bonusReport = asyncHandler(async (req, res) => {
  const filters = parseFilters(req);
  const match = { status: { $ne: 'cancelled' }, 'bonuses.0': { $exists: true } };
  if (filters.period) match.period = filters.period;
  else { const ps = await PayrollPeriod.find({ startDate: { $gte: filters.from, $lte: filters.to } }).select('_id').lean(); match.period = { $in: ps.map((p) => p._id) }; }
  const payslips = await Payslip.find(match).populate('employee', 'employeeId firstName lastName department').populate({ path: 'employee', populate: { path: 'department', select: 'name' } }).populate('period', 'name').sort({ 'employee.employeeId': 1 }).lean();
  const rows = [];
  payslips.forEach((p) => { (p.bonuses || []).forEach((b) => rows.push({ payslipNo: p.payslipNo, period: p.period, employee: p.employee, name: b.name, amount: b.amount })); });
  const totalBonus = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const byEmployeeMap = new Map();
  rows.forEach((r) => { const k = String(r.employee?._id || ''); if (!byEmployeeMap.has(k)) byEmployeeMap.set(k, { employee: r.employee, total: 0, count: 0 }); const e = byEmployeeMap.get(k); e.total += r.amount || 0; e.count++; });
  const byEmployee = Array.from(byEmployeeMap.values()).sort((a, b) => b.total - a.total).slice(0, 15);

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'bonus-report', format: req.query.format, columns: [
      { key: 'payslipNo', header: 'Payslip' }, { key: 'period', header: 'Period', format: (v) => v?.name || '' },
      { key: 'employee', header: 'Employee', format: (v) => v ? `${v.firstName} ${v.lastName}` : '' },
      { key: 'name', header: 'Bonus' }, { key: 'amount', header: 'Amount' },
    ], rows });
  }
  const departments = await Department.find().lean(); const periods = await PayrollPeriod.find().sort({ startDate: -1 }).limit(12).lean();
  res.render('reports/bonus', { title: 'Bonus Report', rows, byEmployee, totalBonus, filters, departments, periods });
});

// ============ 13. Employee Payroll Report ============
const employeePayrollReport = asyncHandler(async (req, res) => {
  const filters = parseFilters(req);
  const match = { status: { $ne: 'cancelled' } };
  applyEmployeeScope(req, match);
  if (filters.period) match.period = filters.period;
  else { const ps = await PayrollPeriod.find({ startDate: { $gte: filters.from, $lte: filters.to } }).select('_id').lean(); match.period = { $in: ps.map((p) => p._id) }; }
  if (req.query.employee) match.employee = req.query.employee;
  let payslips = await Payslip.find(match).populate('employee', 'employeeId firstName lastName department').populate({ path: 'employee', populate: { path: 'department', select: 'name' } }).populate('period', 'name month year startDate').sort({ 'employee.employeeId': 1, 'period.startDate': 1 }).lean();
  if (filters.department) payslips = payslips.filter((p) => String(p.employee?.department?._id || p.employee?.department) === filters.department);
  const byEmpMap = new Map();
  payslips.forEach((p) => { const k = String(p.employee?._id || ''); if (!byEmpMap.has(k)) byEmpMap.set(k, { employee: p.employee, count: 0, gross: 0, net: 0, deductions: 0 }); const e = byEmpMap.get(k); e.count++; e.gross += p.grossEarnings || 0; e.net += p.netPay || 0; e.deductions += p.totalDeductions || 0; });
  const byEmployee = Array.from(byEmpMap.values()).sort((a, b) => b.net - a.net);
  const totals = byEmployee.reduce((acc, e) => ({ gross: acc.gross + e.gross, net: acc.net + e.net, deductions: acc.deductions + e.deductions, count: acc.count + e.count }), { gross: 0, net: 0, deductions: 0, count: 0 });

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'employee-payroll-report', format: req.query.format, columns: [
      { key: 'period', header: 'Period', format: (v) => v?.name || '' },
      { key: 'employee', header: 'Employee', format: (v) => v ? `${v.firstName} ${v.lastName}` : '' },
      { key: 'basicSalary', header: 'Basic' }, { key: 'grossEarnings', header: 'Gross' },
      { key: 'totalDeductions', header: 'Deductions' }, { key: 'netPay', header: 'Net' }, { key: 'status', header: 'Status' },
    ], rows: payslips });
  }
  const departments = await Department.find().lean();
  const employees = await Employee.find({ status: 'active' }).select('employeeId firstName lastName').sort('firstName').lean();
  const periods = await PayrollPeriod.find().sort({ startDate: -1 }).limit(12).lean();
  res.render('reports/employee-payroll', { title: 'Employee Payroll Report', payslips, byEmployee, totals, filters, departments, employees, periods });
});

// ============ 14. Department Report ============
const departmentReport = asyncHandler(async (req, res) => {
  const departments = await Department.find().lean();
  const stats = await Employee.aggregate([{ $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } }, { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } }, { $group: { _id: '$dept._id', name: { $first: '$dept.name' }, total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }, inactive: { $sum: { $cond: [{ $ne: ['$status', 'active'] }, 1, 0] } } } }]);
  const salaryByDept = await SalaryStructure.aggregate([{ $match: { status: 'active' } }, { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'emp' } }, { $unwind: '$emp' }, { $group: { _id: '$emp.department', basicTotal: { $sum: '$basicSalary' } } }]);
  const salMap = new Map(salaryByDept.map((s) => [String(s._id), s.basicTotal]));
  const rows = departments.map((d) => { const s = stats.find((x) => String(x._id) === String(d._id)) || { total: 0, active: 0, inactive: 0 }; return { department: d, total: s.total, active: s.active, inactive: s.inactive, basicTotal: salMap.get(String(d._id)) || 0 }; });

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'department-report', format: req.query.format, columns: [
      { key: 'department', header: 'Department', format: (v) => v?.name || '' },
      { key: 'total', header: 'Total' }, { key: 'active', header: 'Active' }, { key: 'inactive', header: 'Inactive' }, { key: 'basicTotal', header: 'Basic Total' },
    ], rows });
  }
  res.render('reports/department', { title: 'Department Report', rows });
});

// ============ 15. User Activity Report (NEW) ============
const userActivity = asyncHandler(async (req, res) => {
  const filters = parseFilters(req);
  const match = {};
  if (req.query.module) match.module = req.query.module;
  if (req.query.status) match.status = req.query.status;
  if (req.query.action) match.action = { $regex: req.query.action, $options: 'i' };
  if (filters.from || filters.to) { match.createdAt = {}; if (filters.from) match.createdAt.$gte = filters.from; if (filters.to) match.createdAt.$lte = filters.to; }
  const page = parseInt(req.query.page) || 1; const limit = 50; const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    AuditLog.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name email').lean(),
    AuditLog.countDocuments(match),
  ]);
  const byModule = await AuditLog.aggregate([{ $match: match }, { $group: { _id: '$module', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
  const byStatus = await AuditLog.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]);

  if (req.query.format === 'xlsx' || req.query.format === 'csv') {
    return exportTabular(res, { filename: 'user-activity', format: req.query.format, columns: [
      { key: 'createdAt', header: 'When', format: (v) => new Date(v).toLocaleString() },
      { key: 'actorName', header: 'Actor' }, { key: 'module', header: 'Module' },
      { key: 'action', header: 'Action' }, { key: 'description', header: 'Description' },
      { key: 'ip', header: 'IP' }, { key: 'status', header: 'Status' },
    ], rows: items });
  }
  res.render('reports/user-activity', { title: 'User Activity Report', items, total, page, limit, totalPages: Math.ceil(total / limit), byModule, byStatus, filters: req.query });
});

module.exports = {
  index, payrollSummary, payrollRegister, salaryReport, employeeReport,
  attendanceReport, overtimeReport, leaveReport, deductionReport, loanReport,
  taxReport, bonusReport, employeePayrollReport, departmentReport, userActivity,
};
