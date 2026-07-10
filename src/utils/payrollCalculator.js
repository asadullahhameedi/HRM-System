/**
 * Payroll calculation engine.
 *
 * Pure functions: take a salary structure + attendance/leave/loan inputs
 * and return a fully-computed payslip breakdown. Keeping this logic out
 * of controllers/services makes it testable and reusable.
 *
 * Now supports configurable working days and overtime multiplier
 * passed via ctx.settings (from the Settings model).
 */

const DEFAULT_WORK_DAYS = 26;
const DEFAULT_OT_MULTIPLIER = 1.5;

function monthlyToHourly(basicSalary, workDaysPerMonth, hoursPerDay) {
  const monthly = Number(basicSalary) || 0;
  const days = Number(workDaysPerMonth) || DEFAULT_WORK_DAYS;
  const hours = Number(hoursPerDay) || 8;
  return monthly / (days * hours);
}

/**
 * Compute a single payslip.
 *
 * @param {Object} salary - SalaryStructure fields (basic, allowances, deductions definitions)
 * @param {Object} ctx   - { presentDays, absentDays, paidLeaveDays, holidays, overtimeHours, manualAdjustments, loanInstallment, advance, settings }
 * @returns {Object} payslip breakdown with all components + totals
 */
function computePayslip(salary, ctx = {}) {
  const basic = Number(salary?.basicSalary) || 0;

  // Read configurable values from ctx.settings (from Settings model) or use defaults
  const workDaysPerMonth = Number(ctx.settings?.workingDaysPerMonth) || DEFAULT_WORK_DAYS;
  const hoursPerDay = Number(ctx.settings?.workingHoursPerDay) || 8;
  const otMultiplier = Number(ctx.settings?.overtimeMultiplier) || DEFAULT_OT_MULTIPLIER;
  const otEnabled = ctx.settings?.overtimeEnabled !== false;

  // Attendance integration: pro-rate basic by actual paid days
  const presentDays = Number(ctx.presentDays) || 0;
  const paidLeaveDays = Number(ctx.paidLeaveDays) || 0;
  const holidays = Number(ctx.holidays) || 0;
  const absentDays = Number(ctx.absentDays) || 0;
  const expectedDays = presentDays + paidLeaveDays + holidays + absentDays || workDaysPerMonth;

  const paidDays = presentDays + paidLeaveDays + holidays;
  const perDayBasic = basic / workDaysPerMonth;
  const proratedBasic = Math.round(perDayBasic * paidDays);

  // Allowances (flat or percentage per period)
  const allowances = mapComponents(salary?.allowances, proratedBasic);

  // Overtime — only if enabled in settings
  const overtimeHours = otEnabled ? (Number(ctx.overtimeHours) || 0) : 0;
  const hourlyRate = monthlyToHourly(basic, workDaysPerMonth, hoursPerDay);
  const overtimeAmount = otEnabled ? Math.round(hourlyRate * otMultiplier * overtimeHours) : 0;

  // Bonuses / incentives (manual + recurring)
  const bonuses = mapComponents(salary?.bonuses, proratedBasic);
  const incentives = mapComponents(salary?.incentives, proratedBasic);

  // Deductions (statutory + custom)
  const deductions = mapComponents(salary?.deductions, proratedBasic);

  // Tax (percentage of gross)
  const taxPercent = Number(salary?.taxPercent) || 0;
  const grossEarnings = proratedBasic + sum(allowances) + overtimeAmount + sum(bonuses) + sum(incentives);
  const taxAmount = Math.round((grossEarnings * taxPercent) / 100);

  // Absent penalty: deduct per-day basic for unpaid absences
  const absentPenalty = Math.round(perDayBasic * absentDays);

  // Loan deduction + salary advance
  const loanInstallment = Number(ctx.loanInstallment) || 0;
  const advance = Number(ctx.advance) || 0;

  // Manual adjustments
  const manualAdd = Number(ctx.manualAdjustments?.add) || 0;
  const manualDeduct = Number(ctx.manualAdjustments?.deduct) || 0;

  const totalEarnings = grossEarnings + manualAdd;
  const totalDeductions = sum(deductions) + taxAmount + absentPenalty + loanInstallment + advance + manualDeduct;
  const netPay = totalEarnings - totalDeductions;

  return {
    components: {
      basic: proratedBasic,
      allowances,
      overtime: { hours: overtimeHours, amount: overtimeAmount },
      bonuses,
      incentives,
      deductions,
      tax: { percent: taxPercent, amount: taxAmount },
      absentPenalty: { days: absentDays, amount: absentPenalty },
      loan: loanInstallment,
      advance,
      manualAdjustments: { add: manualAdd, deduct: manualDeduct },
    },
    summary: {
      expectedDays,
      paidDays,
      absentDays,
      grossEarnings: totalEarnings,
      totalDeductions,
      netPay,
    },
  };
}

/**
 * Map raw salary-structure component definitions to payslip line items.
 *
 * Supports two component types:
 *   - 'fixed'      → amount is an absolute number
 *   - 'percentage' → amount is a % of basic salary (computed here)
 *
 * Components with a name are always kept (even if amount is 0) so the
 * payslip shows the full structure. Components without a name are dropped.
 */
function mapComponents(arr, basicSalary) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((c) => c && (c.name || c.label))
    .map((c) => {
      const name = c.name || c.label;
      const rawAmount = Number(c.amount) || 0;
      let amount;
      if (c.type === 'percentage' && basicSalary > 0) {
        amount = Math.round((basicSalary * rawAmount) / 100);
      } else {
        amount = rawAmount;
      }
      return { name, amount };
    });
}

function sum(arr) {
  return arr.reduce((acc, c) => acc + c.amount, 0);
}

module.exports = { computePayslip, DEFAULT_WORK_DAYS, DEFAULT_OT_MULTIPLIER };
