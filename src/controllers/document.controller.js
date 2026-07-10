const asyncHandler = require('../utils/asyncHandler');
const documentService = require('../services/document.service');
const auditLog = require('../middleware/audit');
const { paginate } = require('../utils/pagination');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const ApiError = require('../utils/ApiError');
const path = require('path');
const fs = require('fs');
const paths = require('../config/paths');

/**
 * Strip empty-string fields so mongoose doesn't store "" where it should store undefined.
 */
function cleanPayload(body) {
  const cleaned = { ...body };
  ['employee', 'department', 'expiryDate', 'issuedDate'].forEach((key) => {
    if (cleaned[key] === '' || cleaned[key] === undefined) delete cleaned[key];
  });
  return cleaned;
}

const index = asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalPages } = await documentService.listDocuments(req);
  const [employees, departments] = await Promise.all([
    Employee.find({ status: 'active' }).select('employeeId firstName lastName').lean(),
    Department.find({ status: 'active' }).select('name code').lean(),
  ]);
  res.render('documents/index', {
    title: 'Documents',
    documents: items,
    employees,
    departments,
    docTypes: documentService.DOC_TYPES,
    pagination: paginate(total, page, limit, req.originalUrl.split('?')[0]),
    totalPages,
    filters: req.query,
  });
});

const show = asyncHandler(async (req, res) => {
  const doc = await documentService.getDocument(req.params.id);
  res.render('documents/show', {
    title: doc.title,
    doc,
    docTypes: documentService.DOC_TYPES,
  });
});

const create = asyncHandler(async (req, res) => {
  const [employees, departments] = await Promise.all([
    Employee.find({ status: 'active' }).select('employeeId firstName lastName').lean(),
    Department.find({ status: 'active' }).select('name code').lean(),
  ]);
  res.render('documents/form', {
    title: 'New Document',
    doc: {},
    employees,
    departments,
    docTypes: documentService.DOC_TYPES,
    isEdit: false,
  });
});

const store = asyncHandler(async (req, res, next) => {
  const data = cleanPayload(req.body);
  const doc = await documentService.createDocument(data, req.file, req.user._id);
  await auditLog(req, {
    action: 'document.create',
    module: 'document',
    target: doc._id,
    description: `Created document ${doc.docNumber} (${doc.title})`,
  });
  req.flash('success', 'Document created.');
  res.redirect(`/documents/${doc._id}`);
});

const edit = asyncHandler(async (req, res) => {
  const doc = await documentService.getDocument(req.params.id);
  const [employees, departments] = await Promise.all([
    Employee.find({ status: 'active' }).select('employeeId firstName lastName').lean(),
    Department.find({ status: 'active' }).select('name code').lean(),
  ]);
  res.render('documents/form', {
    title: `Edit: ${doc.title}`,
    doc,
    employees,
    departments,
    docTypes: documentService.DOC_TYPES,
    isEdit: true,
  });
});

const update = asyncHandler(async (req, res, next) => {
  const data = cleanPayload(req.body);
  const doc = await documentService.updateDocument(req.params.id, data, req.file);
  await auditLog(req, {
    action: 'document.update',
    module: 'document',
    target: doc._id,
    description: `Updated document ${doc.docNumber}`,
  });
  req.flash('success', 'Document updated.');
  res.redirect(`/documents/${doc._id}`);
});

const destroy = asyncHandler(async (req, res, next) => {
  await documentService.deleteDocument(req.params.id);
  await auditLog(req, {
    action: 'document.delete',
    module: 'document',
    target: req.params.id,
    description: 'Deleted document',
  });
  req.flash('success', 'Document deleted.');
  res.redirect('/documents');
});

const approve = asyncHandler(async (req, res, next) => {
  const doc = await documentService.approveDocument(req.params.id, req.user);
  await auditLog(req, {
    action: 'document.approve',
    module: 'document',
    target: doc._id,
    description: `Approved document ${doc.docNumber}`,
  });
  req.flash('success', 'Document approved.');
  res.redirect(`/documents/${doc._id}`);
});

const reject = asyncHandler(async (req, res, next) => {
  if (!req.body.reason || !req.body.reason.trim()) {
    throw ApiError.badRequest('Rejection reason is required.');
  }
  const doc = await documentService.rejectDocument(req.params.id, req.body.reason, req.user);
  await auditLog(req, {
    action: 'document.reject',
    module: 'document',
    target: doc._id,
    description: `Rejected document ${doc.docNumber}: ${req.body.reason}`,
  });
  req.flash('success', 'Document rejected.');
  res.redirect(`/documents/${doc._id}`);
});

const archive = asyncHandler(async (req, res, next) => {
  const doc = await documentService.archiveDocument(req.params.id);
  await auditLog(req, {
    action: 'document.archive',
    module: 'document',
    target: doc._id,
    description: `Archived document ${doc.docNumber}`,
  });
  req.flash('success', 'Document archived.');
  res.redirect(`/documents/${doc._id}`);
});

/**
 * Download a document's attached file.
 * - Resolves the stored path safely (handles legacy absolute/Windows paths).
 * - Returns a clean 404 page if the file is missing instead of crashing.
 * - Sends the file as an attachment (Content-Disposition: attachment).
 */
const download = asyncHandler(async (req, res, next) => {
  const doc = await documentService.getDocument(req.params.id);
  if (!doc.fileUrl) {
    throw ApiError.notFound('This document has no attached file.');
  }

  const filePath = paths.resolveUploadPath(doc.fileUrl);
  if (!filePath) {
    throw ApiError.notFound('The file path is invalid.');
  }

  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      // Graceful: render 404 instead of 500 ENOENT
      return res.status(404).render('errors/404', {
        title: 'File Not Found',
        layout: false,
        user: req.user || null,
        message: `The attached file for "${doc.title}" could not be found on the server. It may have been moved or deleted. Please re-upload the file.`,
      });
    }

    const downloadName = (doc.fileName || path.basename(filePath)).replace(/[^\w.\- ]+/g, '_');
    res.download(filePath, downloadName, (dlErr) => {
      if (dlErr && dlErr.code !== 'ECONNABORTED' && dlErr.code !== 'EPIPE') {
        // Already sending headers — just log
        require('../utils/logger').warn(`Download failed for ${filePath}: ${dlErr.message}`);
      }
    });
  });
});

module.exports = {
  index,
  show,
  create,
  store,
  edit,
  update,
  destroy,
  approve,
  reject,
  archive,
  download,
};
