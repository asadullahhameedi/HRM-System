/**
 * Default configuration map. Each scope's defaults are merged over by what's
 * stored in the Setting collection — DB wins, these are the fallback.
 *
 * This file is the SINGLE source of truth for "what settings exist" — the
 * Settings UI reads this to render form fields, the service reads it to
 * know which keys to expose.
 */
const baseDefaults = require('./defaults');

module.exports = {
  general: {
    companyName: baseDefaults.companyName,
    companyEmail: baseDefaults.companyEmail,
    companyPhone: baseDefaults.companyPhone,
    companyLogo: baseDefaults.companyLogo,
    favicon: null,
    website: baseDefaults.website,
    address: baseDefaults.address,
    country: baseDefaults.country,
    province: baseDefaults.province,
    city: baseDefaults.city,
    taxNumber: '',
    registrationNumber: '',
    timeZone: baseDefaults.timeZone,
    dateFormat: baseDefaults.dateFormat,
    timeFormat: '24h',
    currency: baseDefaults.currency,
    currencySymbol: baseDefaults.currencySymbol,
    numberFormat: 'en-US',
    fiscalYear: 'Jan-Dec',
    businessHours: baseDefaults.businessHours,
  },

  payroll: {
    payrollFrequency: baseDefaults.payrollFrequency,
    payrollCycle: baseDefaults.payrollCycle,
    workingDaysPerMonth: baseDefaults.workingDaysPerMonth,
    workingHoursPerDay: baseDefaults.workingHoursPerDay,
    overtimeEnabled: baseDefaults.overtimeEnabled,
    overtimeMultiplier: baseDefaults.overtimeMultiplier,
    taxEnabled: baseDefaults.taxEnabled,
    defaultTaxPercent: baseDefaults.defaultTaxPercent,
    pensionEnabled: baseDefaults.pensionEnabled,
    pensionPercent: baseDefaults.pensionPercent,
    insuranceEnabled: baseDefaults.insuranceEnabled,
    insurancePercent: baseDefaults.insurancePercent,
    payrollApprovalWorkflow: baseDefaults.payrollApprovalWorkflow,
    employeeIdPrefix: baseDefaults.employeeIdPrefix,
    payslipPrefix: baseDefaults.payslipPrefix,
    payslipShowLogo: baseDefaults.payslipShowLogo,
    payslipShowSignature: baseDefaults.payslipShowSignature,
    // Salary component catalogues — used by salary-structure form + reports
    earningTypes: [
      { name: 'Basic Salary', type: 'fixed' },
      { name: 'House Rent Allowance', type: 'fixed' },
      { name: 'Transport Allowance', type: 'fixed' },
      { name: 'Food Allowance', type: 'fixed' },
      { name: 'Performance Bonus', type: 'fixed' },
      { name: 'Overtime', type: 'fixed' },
    ],
    deductionTypes: [
      { name: 'Income Tax', type: 'percentage' },
      { name: 'Provident Fund', type: 'percentage' },
      { name: 'Insurance', type: 'fixed' },
      { name: 'Loan Installment', type: 'fixed' },
      { name: 'Salary Advance', type: 'fixed' },
      { name: 'Late Penalty', type: 'fixed' },
    ],
    // Tax brackets (progressive). If empty, flat defaultTaxPercent is used.
    taxBrackets: [],
    pensionRules: { employeeContribution: 0, employerContribution: 0 },
    insuranceRules: { employeeContribution: 0, employerContribution: 0 },
  },

  attendance: {
    workingHoursPerDay: baseDefaults.workingHoursPerDay,
    checkInTime: baseDefaults.checkInTime,
    checkOutTime: baseDefaults.checkOutTime,
    lateGraceMinutes: baseDefaults.lateGraceMinutes,
    weekendDays: [5], // Friday in most of Afghanistan
    breakMinutes: 60,
    shifts: [{ name: 'Morning', start: '09:00', end: '17:00' }],
    flexibleHours: false,
    autoOvertime: true,
  },

  leave: {
    carryForwardEnabled: true,
    maxCarryForward: 10,
    encashmentEnabled: false,
    encashmentRate: 1.0, // 1.0 = full day's basic pay per leave day
    approvalWorkflow: 'manager', // 'manager' | 'hr' | 'admin'
    leaveTypes: [
      { name: 'Annual Leave', code: 'AL', defaultDays: 20, isPaid: true, carryForward: true },
      { name: 'Sick Leave', code: 'SL', defaultDays: 10, isPaid: true, carryForward: false },
      { name: 'Casual Leave', code: 'CL', defaultDays: 5, isPaid: true, carryForward: false },
      { name: 'Unpaid Leave', code: 'UL', defaultDays: 0, isPaid: false, carryForward: false },
    ],
  },

  appearance: {
    defaultTheme: baseDefaults.defaultTheme, // light | dark | system
    // Full color palette — every value flows into CSS variables consumed
    // by Tailwind's brand-* palette + utility classes throughout the app.
    primaryColor: '#164bdc',
    secondaryColor: '#0ea5e9',
    accentColor: '#8b5cf6',
    successColor: '#10b981',
    warningColor: '#f59e0b',
    errorColor: '#ef4444',
    infoColor: '#06b6d4',
    sidebarColor: '#0f172a',     // slate-900
    headerColor: '#164bdc',      // matches primary by default
    backgroundColor: '#f8fafc',  // slate-50
    cardColor: '#ffffff',
    // Layout customization
    sidebarStyle: 'dark',         // 'dark' | 'light' | 'colored'
    sidebarPosition: 'left',      // 'left' | 'right'
    sidebarWidth: 'default',      // 'compact' | 'default' | 'wide'
    layoutWidth: 'boxed',         // 'boxed' | 'fluid'
    fontFamily: 'Inter',
    fontSize: '14px',             // base font size
    borderRadius: '0.5rem',       // card / button corner radius
    cardStyle: 'shadow',          // 'shadow' | 'border' | 'flat'
    shadowStyle: 'soft',          // 'none' | 'soft' | 'medium' | 'hard'
    layoutDensity: 'comfortable', // 'comfortable' | 'compact'
    rtlEnabled: false,
  },
};
