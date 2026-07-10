const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const paths = require('../config/paths');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// Ensure the uploads directory exists the moment this module is loaded,
// and again before every upload, so files always land in the right place
// regardless of how the app was started.
paths.ensureUploadsDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const dir = paths.ensureUploadsDir();
      // Double-check writability
      fs.accessSync(dir, fs.constants.W_OK);
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8);
    const base = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  return cb(ApiError.badRequest(`File type "${file.mimetype}" is not allowed.`));
}

/**
 * Generic upload middleware factory.
 * Usage: upload.single('avatar') | upload.array('documents', 5)
 *
 * Errors (file too large, wrong type, disk full, missing dir) are
 * forwarded to Express error handling instead of crashing the process.
 */
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxFileBytes, files: 10 },
});

module.exports = upload;
module.exports.paths = paths;
