const { Setting } = require('../models');
const settingDefaults = require('../config/settingsDefaults');

/**
 * Settings service — wraps the Setting model with a clean API for
 * controllers/services. Caches merged settings in-process for the
 * configured TTL to avoid hitting the DB on every request.
 *
 * Cache invalidation: call `invalidate()` after any write.
 */

const CACHE_TTL_MS = 60 * 1000; // 1 minute
let cache = null;
let cacheAt = 0;

/**
 * Load all scopes merged over defaults. Returns a flat-ish object:
 *   {
 *     general:    { companyName, currency, ... },
 *     payroll:    { workingDaysPerMonth, taxBrackets, ... },
 *     attendance: { ... },
 *     leave:      { ... },
 *     appearance: { primaryColor, ... },
 *   }
 */
async function loadAll() {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  cache = await Setting.getAllMerged(settingDefaults);
  cacheAt = Date.now();
  return cache;
}

/**
 * Load one scope merged over its defaults.
 */
async function loadScope(scope) {
  const fallback = settingDefaults[scope] || {};
  return Setting.getScope(scope, fallback);
}

/**
 * Persist one scope's data (full replace). Caller is responsible for
 * merging partial updates with existing data first if needed.
 */
async function saveScope(scope, data, updatedBy) {
  await Setting.setScope(scope, data, updatedBy);
  invalidate();
  return loadScope(scope);
}

/**
 * Merge a partial patch into the existing scope data and persist.
 * Useful for forms that only edit a subset of fields.
 */
async function patchScope(scope, patch, updatedBy) {
  const current = await loadScope(scope);
  const merged = deepMerge(current, patch);
  return saveScope(scope, merged, updatedBy);
}

function invalidate() {
  cache = null;
  cacheAt = 0;
}

/**
 * Shallow-aware deep merge for plain objects. Arrays are replaced (not
 * concatenated) to keep catalogue edits predictable.
 */
function deepMerge(target, source) {
  if (Array.isArray(source)) return source.slice();
  if (typeof source !== 'object' || source === null) return source;
  const out = { ...(target || {}) };
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      out[k] = deepMerge(out[k] || {}, source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}

module.exports = {
  loadAll,
  loadScope,
  saveScope,
  patchScope,
  invalidate,
  DEFAULTS: settingDefaults,
};
