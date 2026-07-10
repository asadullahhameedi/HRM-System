const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Database-backed application settings. One document per scope (e.g. 'general',
 * 'payroll', 'attendance', 'leave', 'appearance'). Each document stores a
 * flat key/value object — UI forms write to it, services read from it with
 * a fallback to config/defaults.js.
 *
 * Use Setting.getScope(scope) to load a scope's values merged over defaults.
 */
const settingSchema = new Schema(
  {
    scope: { type: String, required: true, unique: true, index: true, trim: true },
    // Arbitrary key/value bag. Values must be JSON-serializable primitives
    // or arrays/objects. Components, leave types, etc. live here.
    data: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

/**
 * Load one scope's data, falling back to the provided defaults for any
 * missing keys. Returns the merged plain object.
 */
settingSchema.statics.getScope = async function (scope, fallback = {}) {
  const doc = await this.findOne({ scope }).lean();
  if (!doc || !doc.data) return { ...fallback };
  return { ...fallback, ...doc.data };
};

/**
 * Load ALL scopes at once and merge them with the provided fallback map.
 * Used by the per-request locals middleware to expose settings to views.
 */
settingSchema.statics.getAllMerged = async function (fallbackMap = {}) {
  const docs = await this.find().lean();
  const out = {};
  for (const scope of Object.keys(fallbackMap)) out[scope] = { ...fallbackMap[scope] };
  for (const doc of docs) {
    out[doc.scope] = { ...(out[doc.scope] || {}), ...(doc.data || {}) };
  }
  return out;
};

/**
 * Persist one scope's data, upserting the document. Caller controls the
 * full data shape — partial updates should be merged by the caller first.
 */
settingSchema.statics.setScope = async function (scope, data, updatedBy) {
  return this.findOneAndUpdate(
    { scope },
    { $set: { data, updatedBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('Setting', settingSchema);
