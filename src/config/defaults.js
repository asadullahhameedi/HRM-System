/**
 * Default system configuration — replaces the Settings module.
 * These values are used across the entire application for payroll
 * calculation, currency display, company info, and appearance.
 * Change values here to customize the system.
 */

module.exports = Object.freeze({
  // Company
  companyName: 'HRM System',
  companyEmail: 'info@hrm.local',
  companyPhone: '+93 (0) 20 250 0000',
  companyLogo: null,
  website: '',
  address: 'Shahr-e-Naw, Kabul, Afghanistan',
  country: 'Afghanistan',
  province: 'Kabul',
  city: 'Kabul',

  // Localization
  currency: 'AFN',
  currencySymbol: '؋',
  timeZone: 'Asia/Kabul',
  dateFormat: 'YYYY-MM-DD',
  language: 'en',
  businessHours: '09:00-17:00',

  // Payroll
  payrollFrequency: 'monthly',
  payrollCycle: '1-31',
  workingDaysPerMonth: 26,
  workingHoursPerDay: 8,
  overtimeEnabled: true,
  overtimeMultiplier: 1.5,
  taxEnabled: true,
  defaultTaxPercent: 5,
  pensionEnabled: false,
  pensionPercent: 0,
  insuranceEnabled: false,
  insurancePercent: 0,
  checkInTime: '09:00',
  checkOutTime: '17:00',
  lateGraceMinutes: 10,
  payrollApprovalWorkflow: true,
  employeeIdPrefix: 'EMP',
  payslipPrefix: 'PS',
  payslipShowLogo: true,
  payslipShowSignature: true,

  // Appearance
  defaultTheme: 'system',
  colorScheme: 'brand',
});
