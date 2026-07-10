const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const { Payslip, PayrollPeriod, Employee, Payroll } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Stream a PDF payslip for a given payslip id.
 *
 * The payslip object should be a fully-populated Mongoose document (or lean
 * object) with `.employee` and `.period` populated.
 *
 * Key fixes in this version:
 * 1. Uses "AFN" as the currency prefix instead of the Unicode symbol "؋"
 *    because PDFKit's built-in Helvetica font does NOT support the Arabic
 *    Afghani sign (U+060B) — it renders as a corrupted character (³ etc.).
 *    Using the ASCII code "AFN" avoids all font/encoding issues.
 * 2. Safely converts every value to a Number before formatting so undefined
 *    / null / NaN values render as "0.00" instead of "NaN" or blank.
 * 3. Uses `.toObject()` on the payslip if it's a Mongoose document so all
 *    nested arrays/objects are plain JS values that map reliably.
 * 4. Formats numbers with thousands separators: "5,000.00" not "5000" or
 *    "³5000".
 */
function buildPayslipPDF(payslipDoc, settings, res) {
  // ---- Convert Mongoose document to plain object if needed ----
  const payslip = payslipDoc && typeof payslipDoc.toObject === 'function'
    ? payslipDoc.toObject({ virtuals: true })
    : payslipDoc || {};

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payslip.payslipNo || 'payslip'}.pdf"`);
  doc.pipe(res);

  // ---- Currency formatter ----
  // Use the ISO currency code (e.g. "AFN") instead of the Unicode symbol
  // because PDFKit's built-in fonts don't support non-Latin Unicode symbols.
  const currencyCode = settings?.currency || 'AFN';
  const symbol = settings?.currencySymbol || '';

  /**
   * Format a number as currency. Always returns a clean string like
   * "AFN 5,000.00". Handles undefined/null/NaN/strings safely.
   */
  function money(n) {
    var v = Number(n);
    if (isNaN(v)) v = 0;
    return currencyCode + ' ' + v.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Format a plain number (no currency prefix) — used for percentages etc.
   */
  function num(n) {
    var v = Number(n);
    if (isNaN(v)) v = 0;
    return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  // ---- Safely extract nested values ----
  const emp = payslip.employee || {};
  const period = payslip.period || {};
  const empName = emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '—';
  const empId = emp.employeeId || '—';
  const periodName = period.name || '—';
  const payslipNo = payslip.payslipNo || '—';
  const status = (payslip.status || 'draft').toUpperCase();
  const paidAt = payslip.paidAt ? new Date(payslip.paidAt).toLocaleDateString() : '—';

  // ---- Safely extract arrays (they might be undefined on lean objects) ----
  const allowances = Array.isArray(payslip.allowances) ? payslip.allowances : [];
  const bonuses = Array.isArray(payslip.bonuses) ? payslip.bonuses : [];
  const incentives = Array.isArray(payslip.incentives) ? payslip.incentives : [];
  const deductions = Array.isArray(payslip.deductions) ? payslip.deductions : [];

  // ---- Safely extract nested objects ----
  const overtime = payslip.overtime || { hours: 0, amount: 0 };
  const tax = payslip.tax || { percent: 0, amount: 0 };
  const absentPenalty = payslip.absentPenalty || { days: 0, amount: 0 };
  const manualAdjustments = payslip.manualAdjustments || { add: 0, deduct: 0 };

  // ---- Header ----
  doc.fontSize(20).fillColor('#164bdc').text(settings?.companyName || 'HRM System', 50, 50, { align: 'left' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#666').text('Payslip', 50, doc.y, { align: 'left' });
  doc.moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.moveDown(0.8);

  // ---- Employee + period info ----
  doc.fontSize(10).fillColor('#333');
  doc.text('Employee: ' + empName, 50, doc.y, { continued: true });
  doc.text('Employee ID: ' + empId, 300, doc.y);
  doc.moveDown(0.3);
  doc.text('Period: ' + periodName, 50, doc.y, { continued: true });
  doc.text('Payslip No: ' + payslipNo, 300, doc.y);
  doc.moveDown(0.3);
  doc.text('Status: ' + status, 50, doc.y, { continued: true });
  doc.text('Paid At: ' + paidAt, 300, doc.y);
  doc.moveDown(0.8);

  // ---- Build earnings + deductions rows ----
  // Each row is [label, amount] — amount is passed through money() which
  // safely handles undefined/null/NaN.
  var earnings = [
    ['Basic Salary', payslip.basicSalary],
  ];
  allowances.forEach(function(a) {
    earnings.push([a.name || 'Allowance', a.amount]);
  });
  if (Number(overtime.amount) > 0) {
    earnings.push(['Overtime (' + num(overtime.hours) + ' hrs)', overtime.amount]);
  }
  bonuses.forEach(function(b) {
    earnings.push([b.name || 'Bonus', b.amount]);
  });
  incentives.forEach(function(i) {
    earnings.push([i.name || 'Incentive', i.amount]);
  });
  if (Number(manualAdjustments.add) > 0) {
    earnings.push(['Manual Addition', manualAdjustments.add]);
  }

  var deductionRows = [];
  deductions.forEach(function(d) {
    deductionRows.push([d.name || 'Deduction', d.amount]);
  });
  if (Number(tax.amount) > 0) {
    deductionRows.push(['Tax (' + num(tax.percent) + '%)', tax.amount]);
  }
  if (Number(absentPenalty.amount) > 0) {
    deductionRows.push(['Absent Penalty (' + num(absentPenalty.days) + ' days)', absentPenalty.amount]);
  }
  if (Number(payslip.loanInstallment) > 0) {
    deductionRows.push(['Loan Installment', payslip.loanInstallment]);
  }
  if (Number(payslip.advance) > 0) {
    deductionRows.push(['Salary Advance', payslip.advance]);
  }
  if (Number(manualAdjustments.deduct) > 0) {
    deductionRows.push(['Manual Deduction', manualAdjustments.deduct]);
  }

  // ---- Render two-column earnings/deductions table ----
  var tableTop = doc.y;
  doc.fontSize(11).fillColor('#164bdc').text('Earnings', 50, tableTop);
  doc.fontSize(11).fillColor('#164bdc').text('Deductions', 320, tableTop);
  doc.moveDown(0.6);

  var y = doc.y;
  doc.fontSize(10).fillColor('#333');

  var maxRows = Math.max(earnings.length, deductionRows.length);
  for (var i = 0; i < maxRows; i++) {
    var e = earnings[i];
    var d = deductionRows[i];
    if (e) {
      doc.fillColor('#333').text(String(e[0] || ''), 50, y);
      doc.text(money(e[1]), 220, y, { align: 'right' });
    }
    if (d) {
      doc.fillColor('#333').text(String(d[0] || ''), 320, y);
      doc.text(money(d[1]), 520, y, { align: 'right' });
    }
    y += 18;
  }

  doc.moveDown(1);

  // ---- Summary section ----
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.moveDown(0.5);

  var grossEarnings = Number(payslip.grossEarnings);
  if (isNaN(grossEarnings)) grossEarnings = 0;
  var totalDeductions = Number(payslip.totalDeductions);
  if (isNaN(totalDeductions)) totalDeductions = 0;
  var netPay = Number(payslip.netPay);
  if (isNaN(netPay)) netPay = grossEarnings - totalDeductions;

  doc.fontSize(12).fillColor('#333').text('Gross Earnings', 50, doc.y, { continued: true });
  doc.text(money(grossEarnings), 270, doc.y, { align: 'right' });
  doc.moveDown(0.3);
  doc.text('Total Deductions', 50, doc.y, { continued: true });
  doc.text(money(totalDeductions), 270, doc.y, { align: 'right' });
  doc.moveDown(0.6);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#164bdc').lineWidth(2).stroke();
  doc.moveDown(0.4);
  doc.fontSize(14).fillColor('#164bdc').text('Net Pay', 50, doc.y, { continued: true });
  doc.text(money(netPay), 270, doc.y, { align: 'right' });

  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999').text('This is a system-generated payslip and does not require a signature.', { align: 'center' });

  doc.end();
}

/**
 * Build an Excel workbook of payslips for a period and send as download.
 */
async function exportPayrollExcel(periodId, res) {
  const period = await PayrollPeriod.findById(periodId);
  if (!period) throw ApiError.notFound('Period not found.');

  const payslips = await Payslip.find({ period: periodId, status: { $ne: 'cancelled' } })
    .populate('employee', 'employeeId firstName lastName email')
    .lean();

  const rows = payslips.map((p, i) => ({
    '#': i + 1,
    'Payslip No': p.payslipNo,
    'Employee ID': p.employee?.employeeId || '',
    'Employee Name': `${p.employee?.firstName || ''} ${p.employee?.lastName || ''}`.trim(),
    Email: p.employee?.email || '',
    Basic: p.basicSalary,
    Overtime: p.overtime?.amount || 0,
    Bonus: (p.bonuses || []).reduce((s, b) => s + (b.amount || 0), 0),
    Gross: p.grossEarnings,
    Tax: p.tax?.amount || 0,
    Deductions: p.totalDeductions,
    Loan: p.loanInstallment || 0,
    'Net Pay': p.netPay,
    Status: p.status,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

  // Summary sheet
  const summary = await Payroll.findOne({ period: periodId });
  const sumRows = [
    { Metric: 'Period', Value: period.name },
    { Metric: 'Status', Value: period.status },
    { Metric: 'Total Employees', Value: summary?.totalEmployees || 0 },
    { Metric: 'Processed Employees', Value: summary?.processedEmployees || 0 },
    { Metric: 'Total Gross', Value: summary?.totalGross || 0 },
    { Metric: 'Total Deductions', Value: summary?.totalDeductions || 0 },
    { Metric: 'Total Net', Value: summary?.totalNet || 0 },
    { Metric: 'Total Overtime', Value: summary?.totalOvertime || 0 },
    { Metric: 'Total Loans', Value: summary?.totalLoans || 0 },
  ];
  const sumWs = XLSX.utils.json_to_sheet(sumRows);
  XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="payroll-${period.month}-${period.year}.xlsx"`);
  return res.send(buffer);
}

/**
 * Export employees list to Excel.
 */
async function exportEmployeesExcel(res) {
  const employees = await Employee.find()
    .populate('department', 'name code')
    .populate('designation', 'name')
    .lean();

  const rows = employees.map((e, i) => ({
    '#': i + 1,
    'Employee ID': e.employeeId,
    'First Name': e.firstName,
    'Last Name': e.lastName,
    Email: e.email,
    Phone: e.phone || '',
    Department: e.department?.name || '',
    Designation: e.designation?.name || '',
    'Employment Type': e.employmentType,
    Status: e.status,
    'Join Date': e.joinDate ? new Date(e.joinDate).toLocaleDateString() : '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="employees.xlsx"`);
  return res.send(buffer);
}

module.exports = { buildPayslipPDF, exportPayrollExcel, exportEmployeesExcel };
