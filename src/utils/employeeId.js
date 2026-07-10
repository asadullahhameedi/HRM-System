const { Employee } = require('../models');
const ApiError = require('./ApiError');

/**
 * Generate the next sequential employee ID using a configurable prefix
 * and zero-padded counter. Format: EMP-00001
 * Reads the highest existing numeric suffix atomically via a counter
 * collection-free approach (relies on a unique index for safety).
 *
 * The prefix is loaded from the DB-backed payroll settings
 * (settings.payroll.employeeIdPrefix). Falls back to the env var
 * EMPLOYEE_ID_PREFIX, then to 'EMP'.
 */
const ENV_PREFIX = process.env.EMPLOYEE_ID_PREFIX || 'EMP';
const EMPLOYEE_ID_PAD = 5;

async function generateEmployeeId(prefix, pad) {
  // Load prefix from DB-backed settings if not explicitly provided
  if (!prefix) {
    try {
      const settingsService = require('../services/settings.service');
      const all = await settingsService.loadAll();
      prefix = all.payroll?.employeeIdPrefix || ENV_PREFIX;
    } catch (_e) {
      prefix = ENV_PREFIX;
    }
  }
  if (!pad) pad = EMPLOYEE_ID_PAD;

  // Find the max numeric suffix among existing IDs with this prefix
  const regex = new RegExp(`^${prefix}-(\\d+)$`);
  const employees = await Employee.find(
    { employeeId: { $regex: `^${prefix}-` } },
    { employeeId: 1 }
  ).lean();

  let max = 0;
  for (const e of employees) {
    const m = e.employeeId && e.employeeId.match(regex);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }

  const next = max + 1;
  const id = `${prefix}-${String(next).padStart(pad, '0')}`;

  // Defensive uniqueness check (also enforced by unique index in schema)
  const exists = await Employee.exists({ employeeId: id });
  if (exists) {
    throw ApiError.conflict('Employee ID collision, please retry.');
  }
  return id;
}

module.exports = { generateEmployeeId };
