const { Employee, User } = require('../models');
const { generateEmployeeId } = require('../utils/employeeId');
const ApiError = require('../utils/ApiError');
const { parseQuery } = require('../utils/pagination');

async function listEmployees(req) {
  const { page, limit, skip, sort, search, filter } = parseQuery(req, {
    searchableFields: ['employeeId', 'firstName', 'lastName', 'email', 'phone'],
  });

  const query = { ...filter, ...search };
  if (req.query.department) query.department = req.query.department;
  if (req.query.designation) query.designation = req.query.designation;
  if (req.query.employmentType) query.employmentType = req.query.employmentType;

  const [items, total] = await Promise.all([
    Employee.find(query)
      .populate('department', 'name code')
      .populate('designation', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Employee.countDocuments(query),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getEmployee(id) {
  const employee = await Employee.findById(id)
    .populate('department', 'name code')
    .populate('designation', 'name department')
    .populate('user', 'name email role status avatar');
  if (!employee) throw ApiError.notFound('Employee not found.');
  return employee;
}

async function createEmployee(data, createdBy) {
  const emailExists = await Employee.exists({ email: data.email.toLowerCase() });
  if (emailExists) throw ApiError.conflict('An employee with this email already exists.');

  const employeeId = await generateEmployeeId();

  const employee = await Employee.create({
    ...data,
    employeeId,
    email: data.email.toLowerCase(),
    createdBy,
  });

  return employee;
}

async function updateEmployee(id, data) {
  const employee = await Employee.findById(id);
  if (!employee) throw ApiError.notFound('Employee not found.');

  if (data.email && data.email.toLowerCase() !== employee.email) {
    const emailExists = await Employee.exists({ email: data.email.toLowerCase(), _id: { $ne: id } });
    if (emailExists) throw ApiError.conflict('Email is already in use.');
  }

  Object.assign(employee, data);
  await employee.save();
  return employee;
}

async function deleteEmployee(id) {
  const employee = await Employee.findById(id);
  if (!employee) throw ApiError.notFound('Employee not found.');

  // Detach linked user account instead of deleting it
  if (employee.user) {
    await User.findByIdAndUpdate(employee.user, { employee: null });
  }
  await employee.deleteOne();
}

async function searchGlobal(term, limit = 10) {
  if (!term || term.trim().length < 2) return [];
  const q = term.trim();
  const regex = { $regex: q, $options: 'i' };
  const employees = await Employee.find({
    $or: [{ employeeId: regex }, { firstName: regex }, { lastName: regex }, { email: regex }],
    status: 'active',
  })
    .populate('department', 'name')
    .limit(limit)
    .lean();
  return employees;
}

module.exports = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  searchGlobal,
};
