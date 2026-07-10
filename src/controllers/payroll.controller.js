const asyncHandler = require('../utils/asyncHandler');
const payrollService = require('../services/payroll.service');
const reportService = require('../services/report.service');
const auditLog = require('../middleware/audit');
const { paginate } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');
const { Employee } = require('../models');
const defaults = require('../config/defaults');
const settingsService = require('../services/settings.service');

// ---------- Periods ----------
const periods = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } = await payrollService.listPeriods(req);
  res.render('payroll/periods', {
    title: 'Payroll Periods',
    periods: items,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const storePeriod = asyncHandler(async (req, res, next) => {
  const period = await payrollService.createPeriod(req.body, req.user._id);
  await auditLog(req, { action: 'payroll.period.create', module: 'payroll', target: period._id, description: `Created period ${period.name}` });
  req.flash('success', 'Payroll period created.');
  res.redirect('/payroll/periods');
});

const updatePeriod = asyncHandler(async (req, res, next) => {
  const period = await payrollService.updatePeriod(req.params.id, req.body);
  await auditLog(req, { action: 'payroll.period.update', module: 'payroll', target: period._id, description: `Updated period ${period.name}` });
  req.flash('success', 'Period updated.');
  res.redirect('/payroll/periods');
});

const periodStatus = asyncHandler(async (req, res, next) => {
  const period = await payrollService.changePeriodStatus(req.params.id, req.body.status, req.user);
  await auditLog(req, { action: 'payroll.period.status', module: 'payroll', target: period._id, description: `Period ${period.name} → ${period.status}` });
  req.flash('success', `Period status updated to "${period.status}".`);
  res.redirect(`/payroll/periods/${period._id}`);
});

const lockPeriod = asyncHandler(async (req, res, next) => {
  const period = await payrollService.lockPeriod(req.params.id, req.user);
  await auditLog(req, { action: 'payroll.period.lock', module: 'payroll', target: period._id, description: `Locked period ${period.name}` });
  req.flash('success', `Period "${period.name}" has been locked.`);
  res.redirect(`/payroll/periods/${period._id}`);
});

const unlockPeriod = asyncHandler(async (req, res, next) => {
  const period = await payrollService.unlockPeriod(req.params.id, req.user);
  await auditLog(req, { action: 'payroll.period.unlock', module: 'payroll', target: period._id, description: `Unlocked period ${period.name}` });
  req.flash('success', `Period "${period.name}" has been unlocked.`);
  res.redirect(`/payroll/periods/${period._id}`);
});

const recalculatePeriod = asyncHandler(async (req, res, next) => {
  const period = await payrollService.recalculatePeriod(req.params.id, req.user);
  await auditLog(req, { action: 'payroll.period.recalc', module: 'payroll', target: period._id, description: `Recalculated period ${period.name}` });
  req.flash('success', `Period "${period.name}" aggregates recalculated.`);
  res.redirect(`/payroll/periods/${period._id}`);
});

const destroyPeriod = asyncHandler(async (req, res, next) => {
  await payrollService.deletePeriod(req.params.id);
  await auditLog(req, { action: 'payroll.period.delete', module: 'payroll', target: req.params.id, description: 'Deleted period' });
  req.flash('success', 'Period deleted.');
  res.redirect('/payroll/periods');
});

const periodDetail = asyncHandler(async (req, res) => {
  const period = await payrollService.getPeriod(req.params.id);
  const [payslips, employees] = await Promise.all([
    require('../models/Payslip').find({ period: period._id })
      .populate('employee', 'employeeId firstName lastName avatar')
      .lean(),
    Employee.find({ status: 'active' })
      .select('employeeId firstName lastName')
      .sort('firstName')
      .lean(),
  ]);
  // Exclude employees who already have a payslip this period
  const existing = new Set(payslips.map((p) => String(p.employee?._id || p.employee)));
  const availableEmployees = employees.filter((e) => !existing.has(String(e._id)));

  const summary = await payrollService.getPayrollSummary(period._id);
  res.render('payroll/period-detail', {
    title: `Payroll — ${period.name}`,
    period,
    payslips,
    employees: availableEmployees,
    summary,
  });
});

// ---------- Salary Structures ----------
const structures = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } = await payrollService.listStructures(req);
  res.render('payroll/structures', {
    title: 'Salary Structures',
    structures: items,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const structureForm = asyncHandler(async (req, res) => {
  const employees = await Employee.find({ status: 'active' }).select('employeeId firstName lastName').lean();
  let structure = null;
  if (req.params.id) structure = await payrollService.getStructure(req.params.id);
  res.render('payroll/structure-form', {
    title: structure ? 'Edit Salary Structure' : 'Add Salary Structure',
    structure: structure || {},
    employees,
    isEdit: !!structure,
    query: req.query,
  });
});

const storeStructure = asyncHandler(async (req, res, next) => {
  // Parse component arrays from form data
  const data = parseStructureBody(req.body);
  const s = await payrollService.upsertStructure(data, req.user._id);
  await auditLog(req, { action: 'payroll.structure.create', module: 'payroll', target: s._id, description: `Salary structure for employee ${s.employee}` });
  req.flash('success', 'Salary structure saved.');
  res.redirect('/payroll/structures');
});

const updateStructure = asyncHandler(async (req, res, next) => {
  const data = parseStructureBody(req.body);
  const s = await payrollService.updateStructure(req.params.id, data);
  await auditLog(req, { action: 'payroll.structure.update', module: 'payroll', target: s._id, description: 'Updated salary structure' });
  req.flash('success', 'Salary structure updated.');
  res.redirect('/payroll/structures');
});

const destroyStructure = asyncHandler(async (req, res, next) => {
  await payrollService.deleteStructure(req.params.id);
  await auditLog(req, { action: 'payroll.structure.delete', module: 'payroll', target: req.params.id, description: 'Deleted salary structure' });
  req.flash('success', 'Salary structure deleted.');
  res.redirect('/payroll/structures');
});

// ---------- Loans ----------
const loans = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } = await payrollService.listLoans(req);
  const employees = await Employee.find({ status: 'active' }).select('employeeId firstName lastName').lean();
  res.render('payroll/loans', {
    title: 'Loans & Advances',
    loans: items,
    employees,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const storeLoan = asyncHandler(async (req, res, next) => {
  const loan = await payrollService.createLoan(req.body, req.user._id);
  await auditLog(req, { action: 'payroll.loan.create', module: 'payroll', target: loan._id, description: `Loan ${loan.type} of ${loan.principal}` });
  req.flash('success', 'Loan/advance recorded.');
  res.redirect('/payroll/loans');
});

const recordLoanPayment = asyncHandler(async (req, res, next) => {
  const loan = await payrollService.recordLoanPayment(req.params.id, Number(req.body.amount));
  await auditLog(req, { action: 'payroll.loan.payment', module: 'payroll', target: loan._id, description: `Loan payment ${req.body.amount}` });
  req.flash('success', 'Loan payment recorded.');
  res.redirect('/payroll/loans');
});

const updateLoan = asyncHandler(async (req, res, next) => {
  if (req.body.employee === '') delete req.body.employee;
  const loan = await payrollService.updateLoan(req.params.id, req.body);
  await auditLog(req, { action: 'payroll.loan.update', module: 'payroll', target: loan._id, description: `Updated loan` });
  req.flash('success', 'Loan updated.');
  res.redirect('/payroll/loans');
});

const destroyLoan = asyncHandler(async (req, res, next) => {
  await payrollService.deleteLoan(req.params.id);
  await auditLog(req, { action: 'payroll.loan.delete', module: 'payroll', target: req.params.id, description: 'Deleted loan' });
  req.flash('success', 'Loan deleted.');
  res.redirect('/payroll/loans');
});

// ---------- Payslips & runs ----------
const payslips = asyncHandler(async (req, res) => {
  // AJAX endpoint: check if a payslip already exists for an employee+period.
  // Used by the generate form to show the "payslip already exists" warning.
  if (req.query.ajax === '1' && req.query.employee && req.query.period) {
    const Payslip = require('../models/Payslip');
    const existing = await Payslip.findOne({
      employee: req.query.employee,
      period: req.query.period,
    }).select('_id payslipNo status').lean();
    return res.json({ exists: !!existing, payslip: existing });
  }

  const { items, total, page, limit, totalPages } = await payrollService.listPayslips(req);
  const periods = await require('../models/PayrollPeriod').find().sort({ year: -1, month: -1 }).limit(24).lean();
  res.render('payroll/payslips', {
    title: 'Payslips',
    payslips: items,
    periods,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const payslipDetail = asyncHandler(async (req, res) => {
  const payslip = await payrollService.getPayslip(req.params.id);
  if (req.user.role === 'employee' && req.user.employee && String(payslip.employee?._id || payslip.employee) !== String(req.user.employee)) {
    throw ApiError.forbidden('You can only view your own payslips.');
  }
  
  res.render('payroll/payslip-detail', { title: `Payslip ${payslip.payslipNo}`, payslip, settings: defaults });
});

const runPayroll = asyncHandler(async (req, res, next) => {
  const opts = req.body.employees
    ? { employeeIds: Array.isArray(req.body.employees) ? req.body.employees : [req.body.employees] }
    : {};
  const payroll = await payrollService.runPayroll(req.params.periodId, req.user, opts);
  await auditLog(req, { action: 'payroll.run', module: 'payroll', target: payroll._id, description: `Ran payroll: ${payroll.processedEmployees} employees, net ${payroll.totalNet}` });
  req.flash('success', `Payroll run completed for ${payroll.processedEmployees} employee(s).`);
  res.redirect(`/payroll/periods/${req.params.periodId}`);
});

const generateSingle = asyncHandler(async (req, res, next) => {
  // Support both /payslips (POST with body.employee + body.period) and /periods/:periodId/generate
  const employeeId = req.body.employee;
  const periodId = req.params.periodId || req.body.period;
  if (!employeeId) {
    req.flash('error', 'Please select an employee.');
    return res.redirect('/payroll/payslips/create');
  }
  if (!periodId) {
    req.flash('error', 'Please select a payroll period.');
    return res.redirect(`/payroll/payslips/create?employee=${employeeId}`);
  }
  try {
    // Parse optional manual earnings / deductions / narration supplied by
    // the redesigned "Add New Payslip" form. These are merged on top of the
    // auto-computed values from the salary structure + attendance.
    const opts = parsePayslipOptions(req.body);
    const payslip = await payrollService.generatePayslip(employeeId, periodId, req.user._id, opts);
    await auditLog(req, { action: 'payroll.payslip.generate', module: 'payroll', target: payslip._id, description: `Generated payslip ${payslip.payslipNo}` });
    req.flash('success', 'Payslip generated successfully.');
    res.redirect(`/payroll/payslips/${payslip._id}`);
  } catch (err) {
    // Pass the selected employee+period back to the form so the user
    // doesn't have to re-select them after an error.
    const msg = err.message || 'Failed to generate payslip.';
    req.flash('error', msg);
    res.redirect(`/payroll/payslips/create?employee=${employeeId}&period=${periodId}`);
  }
});

/**
 * AJAX endpoint used by the "Add New Payslip" form to fetch auto-calculated
 * values (salary, days, absences, advance, totals) for the selected
 * employee + period. Returns JSON; does NOT persist anything.
 */
const payslipPreview = asyncHandler(async (req, res) => {
  const employeeId = req.query.employee;
  const periodId = req.query.period;
  if (!employeeId || !periodId) {
    throw ApiError.badRequest('Employee and period are required.');
  }
  try {
    const preview = await payrollService.previewPayslip(employeeId, periodId);
    res.json({ ok: true, preview });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || 'Unable to compute preview.' });
  }
});

// Create form — select any employee + any period (all periods, not just open/processing)
const payslipCreateForm = asyncHandler(async (req, res) => {
  const [employees, periods] = await Promise.all([
    require('../models/Employee').find({ status: 'active' }).select('employeeId firstName lastName department').populate('department', 'name').sort('firstName').lean(),
    require('../models/PayrollPeriod').find().sort({ year: -1, month: -1 }).lean(),
  ]);
  // Check if there's an existing payslip for the pre-selected employee+period
  let existingPayslip = null;
  if (req.query.employee && req.query.period) {
    existingPayslip = await require('../models/Payslip').findOne({ employee: req.query.employee, period: req.query.period }).lean();
  }
  res.render('payroll/payslip-form', {
    title: 'Generate Payslip',
    employees,
    periods,
    isEdit: false,
    existingPayslip,
    query: req.query,
    defaults,
  });
});

// Edit form removed — the previous implementation was non-functional (the
// create-form view requires `employees`, `periods`, `defaults` locals which
// were not supplied, so GET /payroll/payslips/:id/edit always 500'd).
// Editing of an existing payslip is done via the "Adjust" modal on the
// payslip detail page (POST /payroll/payslips/:id/adjust). Regeneration
// from latest attendance is done via the "Regenerate" button (which links
// to /payroll/payslips/create?employee=…&period=…).

// Delete payslip
const destroyPayslip = asyncHandler(async (req, res, next) => {
  await require('../models/Payslip').findByIdAndDelete(req.params.id);
  await auditLog(req, { action: 'payroll.payslip.delete', module: 'payroll', target: req.params.id, description: 'Deleted payslip' });
  req.flash('success', 'Payslip deleted.');
  res.redirect('/payroll/payslips');
});

const adjustPayslip = asyncHandler(async (req, res, next) => {
  // Only pass fields that have actual values — empty strings must NOT
  // be converted to 0 (which would zero out existing deductions).
  const numOrUndef = (v) => (v !== undefined && v !== '' && !isNaN(Number(v))) ? Number(v) : undefined;
  const payslip = await payrollService.adjustPayslip(
    req.params.id,
    {
      manualAdd: numOrUndef(req.body.manualAdd),
      manualDeduct: numOrUndef(req.body.manualDeduct),
      overtimeHours: numOrUndef(req.body.overtimeHours),
      loanInstallment: numOrUndef(req.body.loanInstallment),
      advance: numOrUndef(req.body.advance),
      notes: req.body.notes,
    },
    req.user
  );
  await auditLog(req, { action: 'payroll.payslip.adjust', module: 'payroll', target: payslip._id, description: `Adjusted payslip ${payslip.payslipNo}` });
  req.flash('success', 'Payslip adjusted.');
  res.redirect(`/payroll/payslips/${payslip._id}`);
});

const approvePayslip = asyncHandler(async (req, res, next) => {
  const payslip = await payrollService.approvePayslip(req.params.id, req.user);
  await auditLog(req, { action: 'payroll.payslip.approve', module: 'payroll', target: payslip._id, description: `Approved payslip ${payslip.payslipNo}` });
  req.flash('success', 'Payslip approved.');
  res.redirect(`/payroll/payslips/${payslip._id}`);
});

const downloadPayslipPDF = asyncHandler(async (req, res) => {
  const payslip = await payrollService.getPayslip(req.params.id);
  if (!payslip) throw ApiError.notFound('Payslip not found.');

  // Load DB-backed settings so the PDF uses the configured currency code
  // and company name. Falls back to hardcoded defaults if DB is unavailable.
  let pdfSettings = defaults;
  try {
    const all = await settingsService.loadAll();
    pdfSettings = {
      ...defaults,
      ...all.general,
      ...all.payroll,
      currency: all.general?.currency || defaults.currency,
      currencySymbol: all.general?.currencySymbol || defaults.currencySymbol,
      companyName: all.general?.companyName || defaults.companyName,
    };
  } catch (_e) {
    // DB unavailable — use hardcoded defaults
  }

  await auditLog(req, { action: 'payroll.payslip.pdf', module: 'payroll', target: payslip._id, description: `Downloaded PDF ${payslip.payslipNo}` });
  reportService.buildPayslipPDF(payslip, pdfSettings, res);
});

const exportPeriodExcel = asyncHandler(async (req, res) => {
  await reportService.exportPayrollExcel(req.params.periodId, res);
  await auditLog(req, { action: 'payroll.export', module: 'payroll', description: 'Exported payroll to Excel' });
});

// ---------- Helpers ----------
function parseStructureBody(body) {
  const parseComponents = (key) => {
    const names = body[`${key}_name`];
    const amounts = body[`${key}_amount`];
    if (!names) return [];
    const nameArr = Array.isArray(names) ? names : [names];
    const amtArr = Array.isArray(amounts) ? amounts : [amounts];
    return nameArr
      .map((name, i) => ({ name: String(name).trim(), amount: Number(amtArr[i]) || 0 }))
      .filter((c) => c.name);
  };
  return {
    employee: body.employee,
    basicSalary: Number(body.basicSalary) || 0,
    allowances: parseComponents('allowances'),
    bonuses: parseComponents('bonuses'),
    incentives: parseComponents('incentives'),
    deductions: parseComponents('deductions'),
    taxPercent: Number(body.taxPercent) || 0,
    overtimeEnabled: body.overtimeEnabled === 'on' || body.overtimeEnabled === 'true',
    effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
    notes: body.notes,
  };
}

/**
 * Parse the optional manual earnings / deductions / narration fields
 * submitted by the redesigned "Add New Payslip" form. Returns an opts
 * object safe to pass to payrollService.generatePayslip().
 *
 * Recognised body fields:
 *   - earnings_name[] / earnings_amount[]     → extra earning rows
 *   - deductions_name[] / deductions_amount[] → extra deduction rows
 *   - narration                              → free-text notes
 *   - advanceOverride                        → optional manual advance amount
 */
function parsePayslipOptions(body) {
  const pickArray = (v) => (Array.isArray(v) ? v : v != null && v !== '' ? [v] : []);
  const earningsNames = pickArray(body.earnings_name);
  const earningsAmounts = pickArray(body.earnings_amount);
  const extraEarnings = earningsNames
    .map((name, i) => ({ name: String(name || '').trim(), amount: Number(earningsAmounts[i]) || 0 }))
    .filter((e) => e.name);

  const deductionNames = pickArray(body.deductions_name);
  const deductionAmounts = pickArray(body.deductions_amount);
  const extraDeductions = deductionNames
    .map((name, i) => ({ name: String(name || '').trim(), amount: Number(deductionAmounts[i]) || 0 }))
    .filter((d) => d.name);

  const opts = {
    extraEarnings,
    extraDeductions,
    notes: body.narration ? String(body.narration).trim() : undefined,
  };
  if (body.advanceOverride !== undefined && body.advanceOverride !== '') {
    opts.advanceOverride = Number(body.advanceOverride) || 0;
  }
  return opts;
}

module.exports = {
  periods,
  storePeriod,
  updatePeriod,
  periodStatus,
  lockPeriod,
  unlockPeriod,
  recalculatePeriod,
  destroyPeriod,
  periodDetail,
  structures,
  structureForm,
  storeStructure,
  updateStructure,
  destroyStructure,
  loans,
  storeLoan,
  updateLoan,
  destroyLoan,
  recordLoanPayment,
  payslips,
  payslipCreateForm,
  payslipDetail,
  payslipPreview,
  destroyPayslip,
  runPayroll,
  generateSingle,
  adjustPayslip,
  approvePayslip,
  downloadPayslipPDF,
  exportPeriodExcel,
};
