const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');

const index = asyncHandler(async (req, res) => {
  const [overview, headcount, attendanceTrend, payrollTrend, holidays, activity, pendingApprovals, financials] = await Promise.all([
    dashboardService.getOverview(),
    dashboardService.getHeadcountByDepartment(),
    dashboardService.getAttendanceTrend(7),
    dashboardService.getPayrollTrend(6),
    dashboardService.getUpcomingHolidays(5),
    dashboardService.getRecentActivity(8),
    dashboardService.getPendingApprovals(),
    dashboardService.getFinancialSummary(),
  ]);

  // Quick Access modules (only existing routes)
  const allQuickAccess = [
    { path: '/employees', icon: 'users', label: 'Employees', color: 'brand' },
    { path: '/attendance', icon: 'fingerprint', label: 'Attendance', color: 'emerald' },
    { path: '/leave', icon: 'calendar-check', label: 'Leave', color: 'amber' },
    { path: '/payroll/payslips', icon: 'file-invoice-dollar', label: 'Payslips', color: 'violet' },
    { path: '/payroll/structures', icon: 'sliders', label: 'Salary', color: 'sky' },
    { path: '/payroll/loans', icon: 'hand-holding-dollar', label: 'Loans', color: 'rose' },
    { path: '/tasks', icon: 'list-check', label: 'Tasks', color: 'brand' },
    { path: '/documents', icon: 'folder-open', label: 'Documents', color: 'emerald' },
    { path: '/departments', icon: 'sitemap', label: 'Departments', color: 'amber' },
    { path: '/designations', icon: 'id-card-clip', label: 'Designations', color: 'sky' },
    { path: '/holidays', icon: 'calendar-star', label: 'Holidays', color: 'rose' },
  ];

  res.render('dashboard/index', {
    title: 'Dashboard', overview, headcount, attendanceTrend, payrollTrend, holidays, activity,
    pendingApprovals, financials, quickAccess: allQuickAccess,
  });
});

module.exports = { index };
