const { Department, Designation, Employee } = require('../models');
const ApiError = require('../utils/ApiError');
const { parseQuery } = require('../utils/pagination');

async function listDepartments(req) {
  const { page, limit, skip, sort, search, filter } = parseQuery(req, {
    searchableFields: ['name', 'code'],
  });
  const query = { ...filter, ...search };
  const [items, total] = await Promise.all([
    Department.find(query).populate('head', 'firstName lastName employeeId').sort(sort).skip(skip).limit(limit).lean(),
    Department.countDocuments(query),
  ]);

  // Attach employee counts
  const withCounts = await Promise.all(
    items.map(async (d) => ({
      ...d,
      employeeCount: await Employee.countDocuments({ department: d._id, status: 'active' }),
    }))
  );
  return { items: withCounts, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function createDepartment(data, createdBy) {
  const exists = await Department.exists({ $or: [{ name: data.name }, { code: data.code.toUpperCase() }] });
  if (exists) throw ApiError.conflict('Department name or code already exists.');
  return Department.create({ ...data, code: data.code.toUpperCase(), createdBy });
}

async function updateDepartment(id, data) {
  const dept = await Department.findById(id);
  if (!dept) throw ApiError.notFound('Department not found.');
  if (data.code) data.code = data.code.toUpperCase();
  if (data.name && data.name !== dept.name) {
    const dup = await Department.exists({ name: data.name, _id: { $ne: id } });
    if (dup) throw ApiError.conflict('Department name already exists.');
  }
  Object.assign(dept, data);
  await dept.save();
  return dept;
}

async function deleteDepartment(id) {
  const count = await Employee.countDocuments({ department: id, status: 'active' });
  if (count > 0) throw ApiError.badRequest(`Cannot delete: ${count} active employee(s) belong to this department.`);
  await Department.findByIdAndDelete(id);
}

async function listDesignations(req) {
  const { page, limit, skip, sort, search, filter } = parseQuery(req, {
    searchableFields: ['name'],
  });
  const query = { ...filter, ...search };
  if (req.query.department) query.department = req.query.department;
  const [items, total] = await Promise.all([
    Designation.find(query).populate('department', 'name code').sort(sort).skip(skip).limit(limit).lean(),
    Designation.countDocuments(query),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function createDesignation(data, createdBy) {
  const exists = await Designation.exists({ name: data.name });
  if (exists) throw ApiError.conflict('Designation already exists.');
  return Designation.create({ ...data, createdBy });
}

async function updateDesignation(id, data) {
  const desig = await Designation.findById(id);
  if (!desig) throw ApiError.notFound('Designation not found.');
  if (data.name && data.name !== desig.name) {
    const dup = await Designation.exists({ name: data.name, _id: { $ne: id } });
    if (dup) throw ApiError.conflict('Designation name already exists.');
  }
  // Handle empty/null department so it can be cleared (not silently kept).
  if (data.department === '' || data.department === 'null') data.department = null;
  // Explicitly map every editable field so Name, Department, Description and
  // Status are all fully editable (including clearing optional fields).
  if (data.name !== undefined) desig.name = data.name;
  desig.department = data.department === undefined ? desig.department : data.department;
  if (data.description !== undefined) desig.description = data.description;
  if (data.status !== undefined) desig.status = data.status;
  await desig.save();
  return desig;
}

async function deleteDesignation(id) {
  const count = await Employee.countDocuments({ designation: id, status: 'active' });
  if (count > 0) throw ApiError.badRequest(`Cannot delete: ${count} employee(s) hold this designation.`);
  await Designation.findByIdAndDelete(id);
}

module.exports = {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
};
