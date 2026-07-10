const asyncHandler = require('../utils/asyncHandler');
const employeeService = require('../services/employee.service');
const reportService = require('../services/report.service');
const auditLog = require('../middleware/audit');
const { paginate } = require('../utils/pagination');

const index = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } = await employeeService.listEmployees(req);
  const departments = await require('../models/Department').find({ status: 'active' }).lean();
  const designations = await require('../models/Designation').find({ status: 'active' }).lean();

  res.render('employees/index', {
    title: 'Employees',
    employees: items,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    departments,
    designations,
    filters: req.query,
  });
});

const show = asyncHandler(async (req, res) => {
  const employee = await employeeService.getEmployee(req.params.id);
  const SalaryStructure = require('../models/SalaryStructure');
  const Attendance = require('../models/Attendance');
  const Leave = require('../models/Leave');

  const [structure, recentAttendance, recentLeaves] = await Promise.all([
    SalaryStructure.findOne({ employee: req.params.id, status: 'active' }).lean(),
    Attendance.find({ employee: req.params.id }).sort({ date: -1 }).limit(10).lean(),
    Leave.find({ employee: req.params.id }).sort({ createdAt: -1 }).limit(5).populate('leaveType', 'name').lean(),
  ]);

  res.render('employees/show', {
    title: `${employee.fullName} — Employee`,
    employee,
    structure,
    recentAttendance,
    recentLeaves,
  });
});

const create = asyncHandler(async (req, res) => {
  const departments = await require('../models/Department').find({ status: 'active' }).lean();
  const designations = await require('../models/Designation').find({ status: 'active' }).lean();
  res.render('employees/form', {
    title: 'Add Employee',
    employee: {},
    departments,
    designations,
    isEdit: false,
  });
});

const store = asyncHandler(async (req, res, next) => {
  ['department', 'designation', 'joinDate', 'dateOfBirth'].forEach((f) => { if (req.body[f] === '') delete req.body[f]; });
  if (req.file) req.body.avatar = '/uploads/' + req.file.filename;
  const employee = await employeeService.createEmployee(req.body, req.user._id);
  await auditLog(req, {
    action: 'employee.create',
    module: 'employee',
    target: employee._id,
    targetType: 'Employee',
    description: `Created employee ${employee.fullName} (${employee.employeeId})`,
  });
  req.flash('success', 'Employee created successfully.');
  res.redirect(`/employees/${employee._id}`);
});

const edit = asyncHandler(async (req, res) => {
  const employee = await employeeService.getEmployee(req.params.id);
  const departments = await require('../models/Department').find({ status: 'active' }).lean();
  const designations = await require('../models/Designation').find({ status: 'active' }).lean();
  res.render('employees/form', {
    title: 'Edit Employee',
    employee,
    departments,
    designations,
    isEdit: true,
  });
});

const update = asyncHandler(async (req, res, next) => {
  ['department', 'designation', 'joinDate', 'dateOfBirth'].forEach((f) => { if (req.body[f] === '') delete req.body[f]; });
  if (req.file) req.body.avatar = '/uploads/' + req.file.filename;
  const employee = await employeeService.updateEmployee(req.params.id, req.body);
  await auditLog(req, {
    action: 'employee.update',
    module: 'employee',
    target: employee._id,
    targetType: 'Employee',
    description: `Updated employee ${employee.fullName} (${employee.employeeId})`,
  });
  req.flash('success', 'Employee updated successfully.');
  res.redirect(`/employees/${employee._id}`);
});

const destroy = asyncHandler(async (req, res, next) => {
  const employee = await employeeService.getEmployee(req.params.id);
  await employeeService.deleteEmployee(req.params.id);
  await auditLog(req, {
    action: 'employee.delete',
    module: 'employee',
    target: req.params.id,
    targetType: 'Employee',
    description: `Deleted employee ${employee.fullName} (${employee.employeeId})`,
  });
  req.flash('success', 'Employee deleted.');
  res.redirect('/employees');
});

const search = asyncHandler(async (req, res) => {
  const term = req.query.q || req.query.term || '';
  const results = await employeeService.searchGlobal(term, 10);
  res.json({ results });
});

const exportExcel = asyncHandler(async (req, res) => {
  await reportService.exportEmployeesExcel(res);
  await auditLog(req, { action: 'employee.export', module: 'employee', description: 'Exported employees to Excel' });
});

module.exports = { index, show, create, store, edit, update, destroy, search, exportExcel };
