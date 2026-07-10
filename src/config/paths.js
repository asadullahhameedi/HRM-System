const path = require('path');
const fs = require('fs');

/**
 * Centralized, environment-independent path configuration.
 *
 * All paths are resolved relative to THIS file so they are stable
 * regardless of process.cwd() (e.g. whether the app is started from
 * the project folder, an IDE, or a different working directory on
 * Windows / macOS / Linux).
 *
 * Project layout:
 *   hrm-system/            <- ROOT
 *     src/
 *       config/paths.js    <- __dirname (this file)
 *       public/
 *         uploads/         <- UPLOADS (where files are stored)
 */
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(SRC, 'public');
const UPLOADS = path.join(PUBLIC, 'uploads');
// `SRC` and `PUBLIC` are kept here as internal aliases used to derive
// UPLOADS; only `ROOT` and `UPLOADS` are consumed externally.

/**
 * Ensure the uploads directory exists. Safe to call multiple times.
 * Creates parent directories as needed (recursive).
 * @returns {string} absolute path to the uploads directory
 */
function ensureUploadsDir() {
  try {
    fs.mkdirSync(UPLOADS, { recursive: true });
  } catch (err) {
    // Re-throw only if the directory truly doesn't exist after the attempt
    if (!fs.existsSync(UPLOADS)) {
      throw new Error(`Could not create uploads directory at ${UPLOADS}: ${err.message}`);
    }
  }
  return UPLOADS;
}

/**
 * Normalize a stored file path/url into a safe relative path
 * like "filename.png" or "sub/filename.png" — stripping any
 * leading "/uploads/", absolute paths, or backslashes from other OSes.
 *
 * This makes the system resilient to legacy DB entries that may
 * contain absolute Windows paths.
 *
 * @param {string} raw - the value stored in DB (e.g. "/uploads/x.png" or "C:\\...\\x.png")
 * @returns {string|null} the bare filename, or null if invalid
 */
function normalizeStoredPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  // Convert backslashes (Windows) to forward slashes
  let p = raw.replace(/\\/g, '/');
  // Strip everything up to and including the last "/uploads/"
  const idx = p.toLowerCase().indexOf('/uploads/');
  if (idx >= 0) p = p.slice(idx + '/uploads/'.length);
  // If it still looks absolute (starts with a drive letter or /), take the basename
  if (/^[A-Za-z]:/.test(p) || p.startsWith('/')) p = p.split('/').pop();
  // Remove any query/hash and trim
  p = p.split(/[?#]/)[0].trim();
  // Reject path traversal
  if (!p || p.includes('..')) return null;
  return p;
}

/**
 * Resolve a stored file path to an absolute filesystem path.
 * Returns null if the stored path is invalid.
 * @param {string} raw
 * @returns {string|null}
 */
function resolveUploadPath(raw) {
  const filename = normalizeStoredPath(raw);
  if (!filename) return null;
  return path.join(UPLOADS, filename);
}

module.exports = {
  ROOT,
  SRC,
  PUBLIC,
  UPLOADS,
  ensureUploadsDir,
  normalizeStoredPath,
  resolveUploadPath,
};
