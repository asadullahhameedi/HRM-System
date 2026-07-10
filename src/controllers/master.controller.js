const asyncHandler = require('../utils/asyncHandler');
const masterService = require('../services/master.service');
const auditLog = require('../middleware/audit');
const { paginate } = require('../utils/pagination');

// ---------- Departments ----------
const departments = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } = await masterService.listDepartments(req);
  res.render('departments/index', {
    title: 'Departments',
    departments: items,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const storeDepartment = asyncHandler(async (req, res, next) => {
  if (req.body.head === '') delete req.body.head;
  const dept = await masterService.createDepartment(req.body, req.user._id);
  await auditLog(req, { action: 'department.create', module: 'department', target: dept._id, description: `Created department ${dept.name}` });
  req.flash('success', 'Department created.');
  res.redirect('/departments');
});

const updateDepartment = asyncHandler(async (req, res, next) => {
  const dept = await masterService.updateDepartment(req.params.id, req.body);
  await auditLog(req, { action: 'department.update', module: 'department', target: dept._id, description: `Updated department ${dept.name}` });
  req.flash('success', 'Department updated.');
  res.redirect('/departments');
});

const destroyDepartment = asyncHandler(async (req, res, next) => {
  await masterService.deleteDepartment(req.params.id);
  await auditLog(req, { action: 'department.delete', module: 'department', target: req.params.id, description: 'Deleted department' });
  req.flash('success', 'Department deleted.');
  res.redirect('/departments');
});

// ---------- Designations ----------
const designations = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } = await masterService.listDesignations(req);
  const departments = await require('../models/Department').find({ status: 'active' }).lean();
  res.render('designations/index', {
    title: 'Designations',
    designations: items,
    departments,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const storeDesignation = asyncHandler(async (req, res, next) => {
  const desig = await masterService.createDesignation(req.body, req.user._id);
  await auditLog(req, { action: 'designation.create', module: 'designation', target: desig._id, description: `Created designation ${desig.name}` });
  req.flash('success', 'Designation created.');
  res.redirect('/designations');
});

const updateDesignation = asyncHandler(async (req, res, next) => {
  // Allow clearing the department: empty string → null (so the service
  // actually unsets it instead of silently keeping the old value).
  if (req.body.department === '' || req.body.department === 'null') req.body.department = null;
  const desig = await masterService.updateDesignation(req.params.id, req.body);
  await auditLog(req, { action: 'designation.update', module: 'designation', target: desig._id, description: `Updated designation ${desig.name}` });
  req.flash('success', 'Designation updated.');
  res.redirect('/designations');
});

const destroyDesignation = asyncHandler(async (req, res, next) => {
  await masterService.deleteDesignation(req.params.id);
  await auditLog(req, { action: 'designation.delete', module: 'designation', target: req.params.id, description: 'Deleted designation' });
  req.flash('success', 'Designation deleted.');
  res.redirect('/designations');
});

module.exports = {
  departments,
  storeDepartment,
  updateDepartment,
  destroyDepartment,
  designations,
  storeDesignation,
  updateDesignation,
  destroyDesignation,
};
