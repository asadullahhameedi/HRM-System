// Use Doc alias to avoid clash with the global `Document` constructor
const Doc = require('../models/Document');
const ApiError = require('../utils/ApiError');
const { parseQuery } = require('../utils/pagination');
const mongoose = require('mongoose');

/**
 * Catalogue of 18 supported HR document types, each carrying an icon
 * (Font Awesome) for grid display.
 */
const DOC_TYPES = [
  { value: 'employee_id_card', label: 'Employee ID Card', icon: 'fa-id-card' },
  { value: 'employment_certificate', label: 'Employment Certificate', icon: 'fa-file-contract' },
  { value: 'experience_certificate', label: 'Experience Certificate', icon: 'fa-award' },
  { value: 'salary_certificate', label: 'Salary Certificate', icon: 'fa-file-invoice-dollar' },
  { value: 'appointment_letter', label: 'Appointment Letter', icon: 'fa-file-signature' },
  { value: 'offer_letter', label: 'Offer Letter', icon: 'fa-envelope-open-text' },
  { value: 'promotion_letter', label: 'Promotion Letter', icon: 'fa-arrow-trend-up' },
  { value: 'warning_letter', label: 'Warning Letter', icon: 'fa-triangle-exclamation' },
  { value: 'relieving_letter', label: 'Relieving Letter', icon: 'fa-door-open' },
  { value: 'transfer_letter', label: 'Transfer Letter', icon: 'fa-right-left' },
  { value: 'noc_certificate', label: 'NOC Certificate', icon: 'fa-stamp' },
  { value: 'internship_certificate', label: 'Internship Certificate', icon: 'fa-user-graduate' },
  { value: 'training_certificate', label: 'Training Certificate', icon: 'fa-certificate' },
  { value: 'joining_letter', label: 'Joining Letter', icon: 'fa-handshake' },
  { value: 'contract_document', label: 'Contract Document', icon: 'fa-file-lines' },
  { value: 'hr_form', label: 'HR Form', icon: 'fa-clipboard-list' },
  { value: 'company_template', label: 'Company Template', icon: 'fa-pen-ruler' },
  { value: 'other', label: 'Other', icon: 'fa-file' },
];

/**
 * Generate a sequential, type-prefixed document number, e.g.
 *   SAL-2025-0001  for a salary certificate issued in 2025.
 */
async function generateDocNumber(type) {
  const year = new Date().getFullYear();
  const prefixMap = {
    employee_id_card: 'EID',
    employment_certificate: 'EMP',
    experience_certificate: 'EXP',
    salary_certificate: 'SAL',
    appointment_letter: 'APT',
    offer_letter: 'OFR',
    promotion_letter: 'PRM',
    warning_letter: 'WRN',
    relieving_letter: 'RLV',
    transfer_letter: 'TRF',
    noc_certificate: 'NOC',
    internship_certificate: 'INT',
    training_certificate: 'TRN',
    joining_letter: 'JNG',
    contract_document: 'CTR',
    hr_form: 'HRF',
    company_template: 'TPL',
    other: 'DOC',
  };
  const prefix = prefixMap[type] || 'DOC';
  const count = await Doc.countDocuments({ type });
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function listDocuments(req) {
  const { page, limit, skip, sort, search } = parseQuery(req, {
    searchableFields: ['title', 'docNumber', 'description'],
  });

  const query = { ...search };
  if (req.query.type) query.type = req.query.type;
  if (req.query.status) query.status = req.query.status;
  if (req.query.employee) query.employee = req.query.employee;
  if (req.query.department) query.department = req.query.department;

  // Employees only see documents attached to their own profile
  if (req.user?.role === 'employee' && req.user.employee) {
    query.employee = req.user.employee;
  }

  const [items, total] = await Promise.all([
    Doc.find(query)
      .populate('employee', 'employeeId firstName lastName avatar')
      .populate('department', 'name code')
      .populate('approvedBy', 'name')
      .populate('createdBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Doc.countDocuments(query),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getDocument(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid document id.');
  const doc = await Doc.findById(id)
    .populate('employee', 'employeeId firstName lastName email avatar')
    .populate('department', 'name code')
    .populate('approvedBy', 'name')
    .populate('createdBy', 'name')
    .populate('previousVersion', 'title docNumber');
  if (!doc) throw ApiError.notFound('Document not found.');
  return doc;
}

async function createDocument(data, file, createdBy) {
  const docNumber = data.docNumber || (await generateDocNumber(data.type));
  const payload = { ...data, docNumber, createdBy };
  if (file) {
    payload.fileUrl = `/uploads/${file.filename}`;
    payload.fileName = file.originalname;
    payload.fileSize = file.size;
    payload.mimeType = file.mimetype;
  }
  return Doc.create(payload);
}

async function updateDocument(id, data, file) {
  const doc = await Doc.findById(id);
  if (!doc) throw ApiError.notFound('Document not found.');
  Object.assign(doc, data);
  if (file) {
    doc.fileUrl = `/uploads/${file.filename}`;
    doc.fileName = file.originalname;
    doc.fileSize = file.size;
    doc.mimeType = file.mimetype;
    doc.version = (doc.version || 1) + 1;
  }
  await doc.save();
  return doc;
}

async function deleteDocument(id) {
  const doc = await Doc.findById(id);
  if (!doc) throw ApiError.notFound('Document not found.');
  await doc.deleteOne();
}

async function approveDocument(id, user) {
  const doc = await Doc.findById(id);
  if (!doc) throw ApiError.notFound('Document not found.');
  if (doc.status === 'approved') throw ApiError.badRequest('Document is already approved.');
  doc.status = 'approved';
  doc.approvedBy = user._id;
  doc.approvedAt = new Date();
  doc.rejectionReason = undefined;
  await doc.save();
  return doc;
}

async function rejectDocument(id, reason, user) {
  const doc = await Doc.findById(id);
  if (!doc) throw ApiError.notFound('Document not found.');
  if (doc.status === 'rejected') throw ApiError.badRequest('Document is already rejected.');
  doc.status = 'rejected';
  doc.rejectionReason = reason;
  doc.approvedBy = user._id;
  doc.approvedAt = new Date();
  await doc.save();
  return doc;
}

async function archiveDocument(id) {
  const doc = await Doc.findById(id);
  if (!doc) throw ApiError.notFound('Document not found.');
  doc.status = 'archived';
  await doc.save();
  return doc;
}

module.exports = {
  DOC_TYPES,
  generateDocNumber,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  approveDocument,
  rejectDocument,
  archiveDocument,
};
