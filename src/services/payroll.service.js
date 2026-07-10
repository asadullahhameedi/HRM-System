const mongoose = require('mongoose');
const {
  PayrollPeriod,
  SalaryStructure,
  Payslip,
  Payroll,
  Loan,
  Employee,
  Attendance,
  Leave,
  Holiday,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { computePayslip } = require('../utils/payrollCalculator');
const { startOfDay, endOfDay } = require('../utils/date');
const { parseQuery } = require('../utils/pagination');
const logger = require('../utils/logger');
const settingsService = require('./settings.service');
const baseDefaults = require('../config/defaults');

/**
 * Load all settings from the DB-backed settings service, merged over defaults.
 * This ensures that admin changes in the Settings UI actually apply to
 * payroll calculations, currency display, and other system behavior.
 * Falls back to hardcoded defaults if the DB is unavailable.
 */
async function getSettings() {
  try {
    const all = await settingsService.loadAll();
    return {
      // General / company
      companyName: all.general?.companyName || baseDefaults.companyName,
      currency: all.general?.currency || baseDefaults.currency,
      currencySymbol: all.general?.currencySymbol || baseDefaults.currencySymbol,
      dateFormat: all.general?.dateFormat || baseDefaults.dateFormat,
      timeZone: all.general?.timeZone || baseDefaults.timeZone,
      // Payroll
      workingDaysPerMonth: all.payroll?.workingDaysPerMonth || baseDefaults.workingDaysPerMonth,
      workingHoursPerDay: all.payroll?.workingHoursPerDay || baseDefaults.workingHoursPerDay,
      overtimeEnabled: all.payroll?.overtimeEnabled !== false,
      overtimeMultiplier: all.payroll?.overtimeMultiplier || baseDefaults.overtimeMultiplier,
      taxEnabled: all.payroll?.taxEnabled !== false,
      defaultTaxPercent: all.payroll?.defaultTaxPercent || baseDefaults.defaultTaxPercent,
      pensionEnabled: all.payroll?.pensionEnabled || false,
      pensionPercent: all.payroll?.pensionPercent || 0,
      insuranceEnabled: all.payroll?.insuranceEnabled || false,
      insurancePercent: all.payroll?.insurancePercent || 0,
      payrollApprovalWorkflow: all.payroll?.payrollApprovalWorkflow !== false,
      employeeIdPrefix: all.payroll?.employeeIdPrefix || baseDefaults.employeeIdPrefix,
      payslipPrefix: all.payroll?.payslipPrefix || baseDefaults.payslipPrefix,
      payslipShowLogo: all.payroll?.payslipShowLogo !== false,
      payslipShowSignature: all.payroll?.payslipShowSignature !== false,
      earningTypes: all.payroll?.earningTypes || [],
      deductionTypes: all.payroll?.deductionTypes || [],
      // Attendance
      checkInTime: all.attendance?.checkInTime || baseDefaults.checkInTime,
      checkOutTime: all.attendance?.checkOutTime || baseDefaults.checkOutTime,
      lateGraceMinutes: all.attendance?.lateGraceMinutes || baseDefaults.lateGraceMinutes,
      weekendDays: all.attendance?.weekendDays || [5],
      breakMinutes: all.attendance?.breakMinutes || 60,
      flexibleHours: all.attendance?.flexibleHours || false,
      autoOvertime: all.attendance?.autoOvertime !== false,
    };
  } catch (e) {
    // DB unavailable — fall back to hardcoded defaults
    return baseDefaults;
  }
}

// ---------- Periods ----------
async function listPeriods(req) {
  const { page, limit, skip, sort } = parseQuery(req, { searchableFields: ['name', 'payrollCode'] });
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.year) {
    // Year is derived from startDate; filter via date range instead.
    const y = parseInt(req.query.year, 10);
    query.startDate = { $gte: new Date(y, 0, 1), $lte: new Date(y, 11, 31, 23, 59, 59) };
  }
  const [items, total] = await Promise.all([
    PayrollPeriod.find(query).sort(sort).skip(skip).limit(limit).lean(),
    PayrollPeriod.countDocuments(query),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getPeriod(id) {
  const period = await PayrollPeriod.findById(id);
  if (!period) throw ApiError.notFound('Payroll period not found.');
  return period;
}

async function createPeriod(data, createdBy) {
  // Reject duplicate month/year (year derived from startDate)
  const y = data.year || (data.startDate ? new Date(data.startDate).getFullYear() : null);
  if (y && data.month) {
    const exists = await PayrollPeriod.exists({
      month: data.month,
      $expr: { $eq: [{ $year: '$startDate' }, y] },
    });
    if (exists) throw ApiError.conflict('A payroll period already exists for this month/year.');
  }
  // Auto-derive month from startDate if not provided
  if (!data.month && data.startDate) data.month = new Date(data.startDate).getMonth() + 1;
  // Strip legacy fields if accidentally sent
  delete data.payrollType;
  delete data.payrollFrequency;
  delete data.fiscalYear;
  delete data.week;
  return PayrollPeriod.create({ ...data, createdBy });
}

async function updatePeriod(id, data) {
  const period = await PayrollPeriod.findById(id);
  if (!period) throw ApiError.notFound('Payroll period not found.');
  if (['paid', 'closed', 'locked'].includes(period.status)) {
    throw ApiError.badRequest('Closed/paid/locked periods cannot be edited. Unlock first if needed.');
  }
  // Strip legacy fields if accidentally sent
  delete data.payrollType;
  delete data.payrollFrequency;
  delete data.fiscalYear;
  delete data.week;
  data.updatedBy = data.updatedBy || period.updatedBy;
  Object.assign(period, data);
  await period.save();
  return period;
}

async function changePeriodStatus(id, status, user) {
  const period = await PayrollPeriod.findById(id);
  if (!period) throw ApiError.notFound('Payroll period not found.');
  if (period.status === 'locked') {
    throw ApiError.badRequest('Period is locked. Unlock it first to change status.');
  }

  const transitions = {
    open: ['processing', 'closed'],
    processing: ['approved', 'open'],
    approved: ['paid', 'processing'],
    paid: ['closed'],
    closed: [],
  };
  if (!transitions[period.status]?.includes(status)) {
    throw ApiError.badRequest(`Cannot move period from "${period.status}" to "${status}".`);
  }

  period.status = status;
  if (status === 'approved') {
    period.approvedBy = user._id;
    period.approvedAt = new Date();
  }
  if (status === 'paid') period.paidAt = new Date();
  period.updatedBy = user._id;
  await period.save();

  // Cascade payslip statuses
  if (status === 'approved') {
    await Payslip.updateMany({ period: id, status: { $in: ['draft', 'pending'] } }, { status: 'approved' });
  }
  if (status === 'paid') {
    await Payslip.updateMany({ period: id, status: 'approved' }, { status: 'paid', paidAt: new Date() });
  }
  return period;
}

/**
 * Lock a period — freezes it from any further payroll/payslip edits.
 * Payslips in the period are also marked as locked (via their `status`
 * staying as-is, but the period's `locked` flag prevents writes).
 */
async function lockPeriod(id, user) {
  const period = await PayrollPeriod.findById(id);
  if (!period) throw ApiError.notFound('Payroll period not found.');
  if (period.status === 'locked') throw ApiError.badRequest('Period is already locked.');
  period.status = 'locked';
  period.lockedBy = user._id;
  period.lockedAt = new Date();
  period.updatedBy = user._id;
  await period.save();
  return period;
}

/**
 * Unlock a previously-locked period — restores it to its prior status
 * (paid if it had been paid, else open).
 */
async function unlockPeriod(id, user) {
  const period = await PayrollPeriod.findById(id);
  if (!period) throw ApiError.notFound('Payroll period not found.');
  if (period.status !== 'locked') throw ApiError.badRequest('Period is not locked.');
  // Restore to a reasonable prior status
  period.status = period.paidAt ? 'paid' : (period.approvedAt ? 'approved' : 'open');
  period.lockedBy = null;
  period.lockedAt = null;
  period.updatedBy = user._id;
  await period.save();
  return period;
}

/**
 * Recalculate a period's aggregates (totalEmployees, grossSalary,
 * totalEarnings, totalDeductions, netPayroll, processedEmployees,
 * completionPercentage) from its payslips. Useful after manual payslip
 * adjustments. Does NOT regenerate payslips.
 */
async function recalculatePeriod(id, user) {
  const period = await PayrollPeriod.findById(id);
  if (!period) throw ApiError.notFound('Payroll period not found.');
  if (period.status === 'locked') throw ApiError.badRequest('Locked periods cannot be recalculated. Unlock first.');

  const payslips = await Payslip.find({ period: id, status: { $ne: 'cancelled' } }).lean();
  const total = payslips.length;
  const processed = payslips.filter((p) => ['approved', 'paid'].includes(p.status)).length;
  const grossSalary = payslips.reduce((s, p) => s + (p.basicSalary || 0), 0);
  const totalEarnings = payslips.reduce((s, p) => s + (p.grossEarnings || 0), 0);
  const totalDeductions = payslips.reduce((s, p) => s + (p.totalDeductions || 0), 0);
  const netPayroll = payslips.reduce((s, p) => s + (p.netPay || 0), 0);

  period.totalEmployees = total;
  period.processedEmployees = processed;
  period.grossSalary = grossSalary;
  period.totalEarnings = totalEarnings;
  period.totalDeductions = totalDeductions;
  period.netPayroll = netPayroll;
  period.completionPercentage = total > 0 ? Math.round((processed / total) * 100) : 0;
  period.processingStatus = 'completed';
  period.updatedBy = user._id;
  await period.save();
  return period;
}

async function deletePeriod(id) {
  const period = await PayrollPeriod.findById(id);
  if (!period) throw ApiError.notFound('Payroll period not found.');
  if (period.status !== 'open') throw ApiError.badRequest('Only open periods can be deleted.');
  await Payslip.deleteMany({ period: id });
  await Payroll.deleteOne({ period: id });
  await period.deleteOne();
}

// ---------- Salary structures ----------
async function listStructures(req) {
  const { page, limit, skip, sort } = parseQuery(req, { searchableFields: [] });
  const query = {};
  if (req.query.employee) query.employee = req.query.employee;
  if (req.query.status) query.status = req.query.status;
  const [items, total] = await Promise.all([
    SalaryStructure.find(query)
      .populate('employee', 'employeeId firstName lastName avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    SalaryStructure.countDocuments(query),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getStructure(id) {
  const s = await SalaryStructure.findById(id).populate('employee', 'employeeId firstName lastName');
  if (!s) throw ApiError.notFound('Salary structure not found.');
  return s;
}

async function getActiveStructure(employeeId) {
  return SalaryStructure.findOne({ employee: employeeId, status: 'active' });
}

async function upsertStructure(data, createdBy) {
  // Deactivate previous active structure for the employee
  await SalaryStructure.updateMany({ employee: data.employee, status: 'active' }, { status: 'inactive', effectiveTo: new Date() });

  const doc = await SalaryStructure.create({ ...data, status: 'active', effectiveFrom: data.effectiveFrom || new Date(), createdBy });
  return doc;
}

async function updateStructure(id, data) {
  const s = await SalaryStructure.findById(id);
  if (!s) throw ApiError.notFound('Salary structure not found.');
  Object.assign(s, data);
  await s.save();
  return s;
}

async function deleteStructure(id) {
  const s = await SalaryStructure.findById(id);
  if (!s) throw ApiError.notFound('Salary structure not found.');
  await s.deleteOne();
}

// ---------- Loans ----------
async function listLoans(req) {
  const { page, limit, skip, sort } = parseQuery(req, { searchableFields: [] });
  const query = {};
  if (req.query.employee) query.employee = req.query.employee;
  if (req.query.status) query.status = req.query.status;
  if (req.query.type) query.type = req.query.type;
  const [items, total] = await Promise.all([
    Loan.find(query).populate('employee', 'employeeId firstName lastName').sort(sort).skip(skip).limit(limit).lean(),
    Loan.countDocuments(query),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function createLoan(data, createdBy) {
  return Loan.create({ ...data, remainingAmount: data.principal, approvedBy: createdBy, createdBy });
}

async function recordLoanPayment(id, amount) {
  const loan = await Loan.findById(id);
  if (!loan) throw ApiError.notFound('Loan not found.');
  if (loan.status !== 'active') throw ApiError.badRequest('Loan is not active.');
  loan.paidAmount += amount;
  loan.remainingAmount = Math.max(0, loan.principal - loan.paidAmount);
  if (loan.remainingAmount <= 0) {
    loan.status = 'cleared';
    loan.clearedDate = new Date();
  }
  await loan.save();
  return loan;
}

async function updateLoan(id, data) {
  const loan = await Loan.findById(id);
  if (!loan) throw ApiError.notFound('Loan not found.');
  ['employee'].forEach((f) => { if (data[f] === '') delete data[f]; });
  Object.assign(loan, data);
  if (data.principal !== undefined) loan.remainingAmount = loan.principal - loan.paidAmount;
  await loan.save();
  return loan;
}

async function deleteLoan(id) {
  const loan = await Loan.findById(id);
  if (!loan) throw ApiError.notFound('Loan not found.');
  await loan.deleteOne();
}

// ---------- Payslips & payroll run ----------
async function listPayslips(req) {
  const { page, limit, skip, sort } = parseQuery(req, { searchableFields: ['payslipNo'] });
  const query = {};
  if (req.query.period) query.period = req.query.period;
  if (req.query.employee) query.employee = req.query.employee;
  if (req.query.status) query.status = req.query.status;

  // Employees see only their own payslips
  if (req.user?.role === 'employee' && req.user.employee) {
    query.employee = req.user.employee;
  }

  const [items, total] = await Promise.all([
    Payslip.find(query)
      .populate('employee', 'employeeId firstName lastName avatar')
      .populate('period', 'name month year')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Payslip.countDocuments(query),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getPayslip(id) {
  const payslip = await Payslip.findById(id)
    .populate('employee', 'employeeId firstName lastName email department designation avatar address')
    .populate('period', 'name month year startDate endDate paymentDate')
    .populate({
      path: 'employee',
      populate: { path: 'department designation', select: 'name code' },
    });
  if (!payslip) throw ApiError.notFound('Payslip not found.');
  return payslip;
}

/**
 * Compute payslip components for one employee in a given period using
 * their active salary structure + attendance/leave/holiday/loan data.
 *
 * opts:
 *   - manualAdjustments: { add, deduct }
 *   - extraEarnings:     [{ name, amount }]  — user-added earnings (merged into bonuses)
 *   - extraDeductions:   [{ name, amount }]  — user-added deductions (merged into deductions)
 *   - advanceOverride:   Number              — manual advance deduction this period
 */
async function computeEmployeePayslip(employeeId, period, opts = {}) {
  const structure = await getActiveStructure(employeeId);
  if (!structure) {
    throw ApiError.badRequest('No active salary structure for this employee.');
  }

  const from = startOfDay(period.startDate);
  const to = endOfDay(period.endDate);

  // Attendance aggregation
  const attendance = await Attendance.aggregate([
    { $match: { employee: new mongoose.Types.ObjectId(employeeId), date: { $gte: from, $lte: to } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const attMap = attendance.reduce((acc, a) => ({ ...acc, [a._id]: a.count }), {});
  const hasAttendanceRecords = attendance.length > 0;

  // Standard HR convention: if no attendance records exist for the period,
  // assume the employee worked all working days (full pay). This prevents
  // payslips from showing 0 basic salary when attendance isn't tracked.
  const defaults = await getSettings();
  const fullWorkDays = defaults.workingDaysPerMonth;

  let presentDays, absentDays;
  if (hasAttendanceRecords) {
    presentDays = (attMap.present || 0) + (attMap.late || 0) + (attMap['half-day'] || 0) * 0.5;
    absentDays = attMap.absent || 0;
  } else {
    // No attendance data — assume full attendance
    presentDays = fullWorkDays;
    absentDays = 0;
  }

  // Paid leave days
  const paidLeaves = await Leave.aggregate([
    {
      $match: {
        employee: new mongoose.Types.ObjectId(employeeId),
        status: 'approved',
        fromDate: { $lte: to },
        toDate: { $gte: from },
      },
    },
    { $lookup: { from: 'leavetypes', localField: 'leaveType', foreignField: '_id', as: 'lt' } },
    { $unwind: '$lt' },
    { $group: { _id: '$lt.isPaid', days: { $sum: '$days' } } },
  ]);
  const paidLeaveDays = paidLeaves.find((p) => p._id === true)?.days || 0;

  // Holidays in range
  const holidays = await Holiday.countDocuments({ date: { $gte: from, $lte: to } });

  // Overtime hours summed
  const ot = await Attendance.aggregate([
    { $match: { employee: new mongoose.Types.ObjectId(employeeId), date: { $gte: from, $lte: to } } },
    { $group: { _id: null, total: { $sum: '$overtimeHours' } } },
  ]);
  const overtimeHours = ot[0]?.total || 0;

  // Active loan installments — sum ALL active loans for this employee.
  // Separate "loan" type from "advance" type so the form can show them
  // as distinct line items (loan installment vs. advance deduction).
  const activeLoans = await Loan.find({ employee: employeeId, status: 'active' }).sort({ createdAt: 1 });
  let loanInstallment = 0;
  let advanceDeduction = 0;
  let advanceRemainingBefore = 0;
  activeLoans.forEach((loan) => {
    const due = Math.min(loan.installmentAmount, loan.remainingAmount);
    if (loan.type === 'advance') {
      advanceDeduction += due;
      advanceRemainingBefore += loan.remainingAmount;
    } else {
      loanInstallment += due;
    }
  });

  // Load payroll defaults from config (replaces Settings model)
  const payrollSettings = {
    workingDaysPerMonth: defaults.workingDaysPerMonth,
    workingHoursPerDay: defaults.workingHoursPerDay,
    overtimeMultiplier: defaults.overtimeMultiplier,
    overtimeEnabled: defaults.overtimeEnabled && structure.overtimeEnabled !== false,
  };

  // Allow caller to override the auto-computed advance deduction
  const advanceAmount = opts.advanceOverride != null ? Number(opts.advanceOverride) || 0 : advanceDeduction;

  const computed = computePayslip(structure.toObject(), {
    presentDays,
    absentDays,
    paidLeaveDays,
    holidays,
    overtimeHours,
    loanInstallment,
    advance: advanceAmount,
    manualAdjustments: opts.manualAdjustments || { add: 0, deduct: 0 },
    settings: payrollSettings,
  });

  // Merge user-supplied extra earnings / deductions into the computed
  // component lists so they appear as line items on the payslip.
  const extraEarnings = Array.isArray(opts.extraEarnings)
    ? opts.extraEarnings
        .filter((e) => e && e.name && !isNaN(Number(e.amount)))
        .map((e) => ({ name: String(e.name).trim(), amount: Number(e.amount) || 0 }))
    : [];
  const extraDeductions = Array.isArray(opts.extraDeductions)
    ? opts.extraDeductions
        .filter((d) => d && d.name && !isNaN(Number(d.amount)))
        .map((d) => ({ name: String(d.name).trim(), amount: Number(d.amount) || 0 }))
    : [];

  // Augment the computed components with extra rows and re-tally totals
  const bonuses = [...computed.components.bonuses, ...extraEarnings];
  const deductions = [...computed.components.deductions, ...extraDeductions];
  const extraEarningsTotal = extraEarnings.reduce((s, e) => s + e.amount, 0);
  const extraDeductionsTotal = extraDeductions.reduce((s, d) => s + d.amount, 0);

  const grossEarnings = computed.summary.grossEarnings + extraEarningsTotal;
  const totalDeductions = computed.summary.totalDeductions + extraDeductionsTotal;
  const netPay = grossEarnings - totalDeductions;

  const finalComputed = {
    components: {
      ...computed.components,
      bonuses,
      deductions,
    },
    summary: {
      ...computed.summary,
      grossEarnings,
      totalDeductions,
      netPay,
    },
  };

  return {
    structure,
    computed: finalComputed,
    attendance: { presentDays, absentDays, paidLeaveDays, holidays },
    loanInstallment,
    advanceDeduction,
    advanceRemainingBefore,
    advanceRemainingAfter: Math.max(0, advanceRemainingBefore - advanceAmount),
    activeLoans,
    overtimeHours,
    extraEarnings,
    extraDeductions,
  };
}

/**
 * Lightweight preview used by the "Add New Payslip" form to show
 * auto-calculated values (salary, days, absences, advance, totals)
 * BEFORE the user saves. Does NOT persist anything.
 *
 * Returns a plain JSON-safe object.
 */
async function previewPayslip(employeeId, periodId) {
  const period = await getPeriod(periodId);
  const {
    structure,
    computed,
    attendance,
    loanInstallment,
    advanceDeduction,
    advanceRemainingBefore,
    advanceRemainingAfter,
    overtimeHours,
  } = await computeEmployeePayslip(employeeId, period);

  const defaults = await getSettings();

  // Sum recurring allowances/bonuses/incentives from the salary structure
  // so the form can show "Salary" as basic + recurring components.
  const recurringAllowances = (structure.allowances || []).reduce(
    (s, a) => s + (Number(a.amount) || 0),
    0
  );

  return {
    period: {
      _id: String(period._id),
      name: period.name,
      month: period.month,
      year: period.year,
    },
    currency: defaults.currency,
    currencySymbol: defaults.currencySymbol,
    monthDays: defaults.workingDaysPerMonth,
    salary: {
      basic: structure.basicSalary,
      recurringAllowances,
      total: structure.basicSalary + recurringAllowances,
    },
    attendance,
    absentDaysDeduction: computed.components.absentPenalty.amount,
    loanInstallment,
    advance: advanceDeduction,
    remainingAdvanceBefore: advanceRemainingBefore,
    remainingAdvanceAfter: advanceRemainingAfter,
    overtimeHours,
    summary: {
      grossEarnings: computed.summary.grossEarnings,
      totalDeductions: computed.summary.totalDeductions,
      netSalary: computed.summary.grossEarnings - (computed.summary.totalDeductions - computed.components.advance),
      payableSalary: computed.summary.netPay,
    },
  };
}

async function generatePayslipNo(period, settings) {
  const prefix = settings?.payslipPrefix || 'PS';
  const count = await Payslip.countDocuments({ period: period._id });
  return `${prefix}-${period.year}${String(period.month).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Generate (or regenerate) a single payslip for an employee in a period.
 *
 * Works for ANY period status (open/processing/approved/paid/closed).
 * The user can generate or regenerate payslips at any time for any
 * previous period. Regenerating a paid/closed period resets the
 * payslip to 'draft' so it can be re-approved after the numbers change.
 */
async function generatePayslip(employeeId, periodId, createdBy, opts = {}) {
  const period = await getPeriod(periodId);

  const { structure, computed, attendance, activeLoans } = await computeEmployeePayslip(employeeId, period, opts);

  // Read payslip prefix from DB-backed settings
  const defaults = await getSettings();
  const existing = await Payslip.findOne({ period: periodId, employee: employeeId });
  const payslipNo = existing?.payslipNo || (await generatePayslipNo(period, defaults));

  // Determine the new status:
  // - New payslip → 'draft'
  // - Existing 'approved'/'paid' payslip that is being regenerated → reset to 'draft'
  //   (because the numbers changed; it must be re-approved)
  // - Existing 'draft'/'pending' → keep as-is
  let newStatus;
  if (!existing) {
    newStatus = 'draft';
  } else if (['approved', 'paid'].includes(existing.status)) {
    newStatus = 'draft'; // reset after regen — numbers changed
  } else {
    newStatus = existing.status;
  }

  // A payslip is considered "manual" if the user supplied any extra
  // earnings, extra deductions, manual adjustments, narration, or
  // overrode the auto-computed advance amount.
  const hasManualAdjust = !!opts.manualAdjustments && (Number(opts.manualAdjustments.add) > 0 || Number(opts.manualAdjustments.deduct) > 0);
  const hasExtraEarnings = Array.isArray(opts.extraEarnings) && opts.extraEarnings.some((e) => e && e.name);
  const hasExtraDeductions = Array.isArray(opts.extraDeductions) && opts.extraDeductions.some((d) => d && d.name);
  const hasAdvanceOverride = opts.advanceOverride != null && Number(opts.advanceOverride) > 0;
  const isManual = hasManualAdjust || hasExtraEarnings || hasExtraDeductions || hasAdvanceOverride || !!opts.notes;

  const payload = {
    payslipNo,
    period: periodId,
    employee: employeeId,
    salaryStructure: structure._id,
    basicSalary: computed.components.basic,
    allowances: computed.components.allowances,
    overtime: computed.components.overtime,
    bonuses: computed.components.bonuses,
    incentives: computed.components.incentives,
    deductions: computed.components.deductions,
    tax: computed.components.tax,
    absentPenalty: computed.components.absentPenalty,
    loanInstallment: computed.components.loan,
    advance: computed.components.advance,
    manualAdjustments: computed.components.manualAdjustments,
    grossEarnings: computed.summary.grossEarnings,
    totalDeductions: computed.summary.totalDeductions,
    netPay: computed.summary.netPay,
    attendance,
    status: newStatus,
    isManual,
    notes: opts.notes,
    createdBy,
  };

  let payslip;
  if (existing) {
    Object.assign(existing, payload);
    payslip = await existing.save();
  } else {
    payslip = await Payslip.create(payload);
  }

  // Record loan installment deductions against ALL active loans.
  // IMPORTANT: Only deduct if this is a NEW payslip OR the existing payslip
  // had a different loan installment amount. Re-running payroll on an
  // existing payslip must NOT double-deduct loans.
  //
  // We split active loans into two buckets:
  //   - type 'loan'    → recorded against loanInstallment
  //   - type 'advance' → recorded against the advance field
  // Both buckets share the same Loan schema and use recordLoanPayment()
  // to decrement remainingAmount.
  const previousLoanDeduction = existing && existing.loanInstallment ? existing.loanInstallment : 0;
  const previousAdvanceDeduction = existing && existing.advance ? existing.advance : 0;
  const newLoanDeduction = computed.components.loan;
  const newAdvanceDeduction = computed.components.advance;

  // Helper: deduct the difference (existing → new) across a list of loans,
  // oldest first. No-op when amounts are unchanged (re-run case).
  async function settleLoanBucket(loans, previousAmt, newAmt) {
    if (!loans.length || newAmt <= 0 || newAmt === previousAmt) return;
    const amountToDeduct = Math.max(0, newAmt - previousAmt);
    if (amountToDeduct <= 0) return;
    let remainingToDeduct = amountToDeduct;
    for (const activeLoan of loans) {
      if (remainingToDeduct <= 0) break;
      const deduction = Math.min(activeLoan.installmentAmount, activeLoan.remainingAmount, remainingToDeduct);
      if (deduction > 0) {
        await recordLoanPayment(activeLoan._id, deduction);
        remainingToDeduct -= deduction;
      }
    }
  }

  const loanBuckets = activeLoans.filter((l) => l.type !== 'advance');
  const advanceBuckets = activeLoans.filter((l) => l.type === 'advance');
  await settleLoanBucket(loanBuckets, previousLoanDeduction, newLoanDeduction);
  await settleLoanBucket(advanceBuckets, previousAdvanceDeduction, newAdvanceDeduction);

  return payslip;
}

/**
 * Run payroll for ALL active employees in a period.
 * Idempotent: re-running updates existing payslips (unless approved).
 */
async function runPayroll(periodId, runBy, opts = {}) {
  const period = await getPeriod(periodId);
  // Allow re-running payroll for any period (including paid/closed) —
  // the user may need to regenerate payslips for previous periods.
  // Payslips that were 'approved'/'paid' are reset to 'draft' by generatePayslip.

  const employees = await Employee.find({ status: 'active' }).select('_id').lean();
  const eligible = opts.employeeIds
    ? employees.filter((e) => opts.employeeIds.map(String).includes(String(e._id)))
    : employees;

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  let totalOvertime = 0;
  let totalLoans = 0;
  let processed = 0;

  for (const emp of eligible) {
    try {
      const ps = await generatePayslip(emp._id, periodId, runBy);
      totalGross += ps.grossEarnings;
      totalDeductions += ps.totalDeductions;
      totalNet += ps.netPay;
      totalOvertime += ps.overtime.amount;
      totalLoans += ps.loanInstallment;
      processed++;
    } catch (err) {
      // Skip employees without salary structure; logged for transparency
      logger.warn(`Payroll skip ${emp._id}: ${err.message}`);
    }
  }

  period.status = 'processing';
  period.processingStatus = 'in_progress';
  period.updatedBy = runBy._id;
  await period.save();

  let payroll = await Payroll.findOne({ period: periodId });
  if (!payroll) payroll = new Payroll({ period: periodId });
  payroll.totalEmployees = eligible.length;
  payroll.processedEmployees = processed;
  payroll.totalGross = totalGross;
  payroll.totalDeductions = totalDeductions;
  payroll.totalNet = totalNet;
  payroll.totalOvertime = totalOvertime;
  payroll.totalLoans = totalLoans;
  payroll.status = 'completed';
  payroll.runBy = runBy;
  await payroll.save();

  // Sync aggregate fields on the period itself (used by the periods list
  // and dashboard). Delegates to recalculatePeriod which uses the actual
  // payslips — keeping the period and payroll documents consistent.
  try {
    await recalculatePeriod(periodId, runBy);
  } catch (_e) {
    // recalculation is best-effort; the payroll doc above is the source of truth
  }

  return payroll;
}

async function adjustPayslip(id, { manualAdd, manualDeduct, overtimeHours, loanInstallment, advance, notes }, user) {
  const payslip = await Payslip.findById(id).populate('period');
  if (!payslip) throw ApiError.notFound('Payslip not found.');
  if (['paid', 'cancelled'].includes(payslip.status)) {
    throw ApiError.badRequest('Paid/cancelled payslips cannot be adjusted.');
  }

  // Recompute with overrides using stored structure snapshot
  const structure = await SalaryStructure.findById(payslip.salaryStructure);
  if (!structure) throw ApiError.badRequest('Source salary structure not found.');

  const computed = computePayslip(structure.toObject(), {
    presentDays: payslip.attendance.presentDays,
    absentDays: payslip.attendance.absentDays,
    paidLeaveDays: payslip.attendance.paidLeaveDays,
    holidays: payslip.attendance.holidays,
    overtimeHours: overtimeHours ?? payslip.overtime.hours,
    loanInstallment: loanInstallment ?? payslip.loanInstallment,
    advance: advance ?? payslip.advance,
    manualAdjustments: { add: manualAdd ?? payslip.manualAdjustments.add, deduct: manualDeduct ?? payslip.manualAdjustments.deduct },
  });

  payslip.basicSalary = computed.components.basic;
  payslip.allowances = computed.components.allowances;
  payslip.overtime = computed.components.overtime;
  payslip.bonuses = computed.components.bonuses;
  payslip.incentives = computed.components.incentives;
  payslip.deductions = computed.components.deductions;
  payslip.tax = computed.components.tax;
  payslip.absentPenalty = computed.components.absentPenalty;
  payslip.loanInstallment = computed.components.loan;
  payslip.advance = computed.components.advance;
  payslip.manualAdjustments = computed.components.manualAdjustments;
  payslip.grossEarnings = computed.summary.grossEarnings;
  payslip.totalDeductions = computed.summary.totalDeductions;
  payslip.netPay = computed.summary.netPay;
  payslip.isManual = true;
  if (notes) payslip.notes = notes;
  payslip.approvedBy = user._id;
  await payslip.save();

  return payslip;
}

async function approvePayslip(id, user) {
  const payslip = await Payslip.findById(id);
  if (!payslip) throw ApiError.notFound('Payslip not found.');
  if (payslip.status === 'paid') throw ApiError.badRequest('Payslip already paid.');
  payslip.status = 'approved';
  payslip.approvedBy = user._id;
  await payslip.save();
  return payslip;
}

async function getPayrollSummary(periodId) {
  const payroll = await Payroll.findOne({ period: periodId });
  if (!payroll) return null;
  return payroll;
}

/**
 * Yearly summary — used by the Reports module's Payroll Summary report.
 */
async function getYearlySummary(year) {
  const periods = await PayrollPeriod.find({
    startDate: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31, 23, 59, 59) },
  }).sort({ startDate: 1 }).lean();
  const periodIds = periods.map((p) => p._id);
  const monthly = await Payslip.aggregate([
    { $match: { period: { $in: periodIds }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$period', gross: { $sum: '$grossEarnings' }, net: { $sum: '$netPay' }, deductions: { $sum: '$totalDeductions' } } },
  ]);
  const map = new Map(monthly.map((m) => [String(m._id), m]));
  return periods.map((p) => ({
    period: p,
    gross: map.get(String(p._id))?.gross || 0,
    net: map.get(String(p._id))?.net || 0,
    deductions: map.get(String(p._id))?.deductions || 0,
  }));
}

module.exports = {
  listPeriods,
  getPeriod,
  createPeriod,
  updatePeriod,
  changePeriodStatus,
  lockPeriod,
  unlockPeriod,
  recalculatePeriod,
  deletePeriod,
  listStructures,
  getStructure,
  getActiveStructure,
  upsertStructure,
  updateStructure,
  deleteStructure,
  listLoans,
  createLoan,
  updateLoan,
  deleteLoan,
  recordLoanPayment,
  listPayslips,
  getPayslip,
  generatePayslip,
  previewPayslip,
  runPayroll,
  adjustPayslip,
  approvePayslip,
  getPayrollSummary,
  getYearlySummary,
};
