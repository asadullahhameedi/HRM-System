const asyncHandler = require('../utils/asyncHandler');
const settingsService = require('../services/settings.service');
const auditLog = require('../middleware/audit');
const ApiError = require('../utils/ApiError');
const ejs = require('ejs');
const path = require('path');

const SCOPES = ['general', 'payroll', 'attendance', 'leave', 'appearance'];

/**
 * Render a scope's form inside the shared settings _layout wrapper.
 * The wrapper provides the sticky tab sidebar + breadcrumb + heading.
 * Each scope view provides only the form body.
 *
 * We use ejs.renderFile directly (bypassing express-ejs-layouts) for the
 * inner scope view so it renders WITHOUT the main layout. The result is
 * then injected into _layout via the `body` local.
 */
function renderScope(req, res, scope, title, icon) {
  const settings = res.locals.settingsMap[scope] || settingsService.DEFAULTS[scope] || {};
  const viewPath = path.join(__dirname, '..', 'views', 'settings', scope + '.ejs');
  const locals = {
    settings,
    settingsMap: res.locals.settingsMap,
    user: req.user,
    currentPath: req.path,
    currencySymbol: res.locals.currencySymbol,
    appName: res.locals.appName,
    theme: res.locals.theme,
    flash: { success: [], error: [], warning: [], info: [] },
    year: res.locals.year,
    primaryColor: res.locals.primaryColor,
    secondaryColor: res.locals.secondaryColor,
    accentColor: res.locals.accentColor,
    fontFamily: res.locals.fontFamily,
    filename: viewPath,
    root: path.join(__dirname, '..', 'views'),
    views: [path.join(__dirname, '..', 'views')],
  };
  return new Promise((resolve, reject) => {
    ejs.renderFile(viewPath, locals, { filename: viewPath, root: path.join(__dirname, '..', 'views') }, (err, html) => {
      if (err) return reject(err);
      res.render('settings/_layout', {
        title,
        icon,
        activeScope: scope,
        formBody: html,
        settingsMap: res.locals.settingsMap,
      });
      resolve();
    });
  });
}

const general = asyncHandler(async (req, res) => renderScope(req, res, 'general', 'General Settings', 'building'));
const payroll = asyncHandler(async (req, res) => renderScope(req, res, 'payroll', 'Payroll Settings', 'file-invoice-dollar'));
const attendance = asyncHandler(async (req, res) => renderScope(req, res, 'attendance', 'Attendance Settings', 'fingerprint'));
const leave = asyncHandler(async (req, res) => renderScope(req, res, 'leave', 'Leave Settings', 'calendar-check'));
const appearance = asyncHandler(async (req, res) => renderScope(req, res, 'appearance', 'Appearance Settings', 'palette'));

// ---- Audit logs view (read-only listing) ----
const audit = asyncHandler(async (req, res) => {
  const AuditLog = require('../models/AuditLog');
  const { page = 1, limit = 25, module, status, action, from, to } = req.query;
  const query = {};
  if (module) query.module = module;
  if (status) query.status = status;
  if (action) query.action = { $regex: action, $options: 'i' };
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to + 'T23:59:59');
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('actor', 'name email').lean(),
    AuditLog.countDocuments(query),
  ]);
  const auditViewPath = path.join(__dirname, '..', 'views', 'settings', 'audit.ejs');
  const viewsDir = path.join(__dirname, '..', 'views');
  const auditLocals = {
    items,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
    filters: req.query,
    user: req.user,
    currentPath: req.path,
    currencySymbol: res.locals.currencySymbol,
    appName: res.locals.appName,
    theme: res.locals.theme,
    flash: { success: [], error: [], warning: [], info: [] },
    year: res.locals.year,
    filename: auditViewPath,
    root: viewsDir,
    views: [viewsDir],
  };
  return new Promise((resolve, reject) => {
    ejs.renderFile(auditViewPath, auditLocals, { filename: auditViewPath, root: viewsDir }, (err, html) => {
      if (err) return reject(err);
      res.render('settings/_layout', {
        title: 'Audit & Monitoring',
        icon: 'shield-halved',
        activeScope: 'audit',
        formBody: html,
        settingsMap: res.locals.settingsMap,
      });
      resolve();
    });
  });
});

// ---- Save handler ----
const save = asyncHandler(async (req, res) => {
  const scope = req.params.scope;
  if (!SCOPES.includes(scope)) throw ApiError.badRequest('Unknown settings scope: ' + scope);
  const body = normalizeBooleans(req.body, scope);
  await settingsService.saveScope(scope, body, req.user._id);
  await auditLog(req, { action: 'settings.update', module: 'settings', target: scope, description: `Updated ${scope} settings` });
  req.flash('success', 'Settings saved successfully.');
  res.redirect('/settings/' + scope);
});

function normalizeBooleans(body, scope) {
  const out = { ...body };
  const boolFields = {
    general: [],
    payroll: ['overtimeEnabled', 'taxEnabled', 'pensionEnabled', 'insuranceEnabled', 'payrollApprovalWorkflow', 'payslipShowLogo', 'payslipShowSignature'],
    attendance: ['flexibleHours', 'autoOvertime'],
    leave: ['carryForwardEnabled', 'encashmentEnabled'],
    appearance: ['rtlEnabled'],
  };
  for (const f of boolFields[scope] || []) {
    out[f] = out[f] === 'on' || out[f] === 'true' || out[f] === true;
  }
  const numFields = {
    general: [],
    payroll: ['workingDaysPerMonth', 'workingHoursPerDay', 'overtimeMultiplier', 'defaultTaxPercent', 'pensionPercent', 'insurancePercent'],
    attendance: ['workingHoursPerDay', 'lateGraceMinutes', 'breakMinutes'],
    leave: ['maxCarryForward', 'encashmentRate'],
    appearance: [],
  };
  for (const f of numFields[scope] || []) {
    if (out[f] !== undefined && out[f] !== '') out[f] = Number(out[f]);
    else delete out[f];
  }
  if (scope === 'attendance' && out.weekendDays) {
    out.weekendDays = Array.isArray(out.weekendDays) ? out.weekendDays.map(Number) : [Number(out.weekendDays)];
  }
  if (scope === 'payroll') {
    out.earningTypes = parseCatalogue(body, 'earningTypes');
    out.deductionTypes = parseCatalogue(body, 'deductionTypes');
  }
  return out;
}

function parseCatalogue(body, prefix, fields) {
  if (!fields) fields = ['name', 'amount', 'type'];
  const names = body[`${prefix}_name`];
  if (!names) return [];
  const arr = (v) => (Array.isArray(v) ? v : [v]);
  const nameArr = arr(names);
  const typeArr = arr(body[`${prefix}_type`] || []);
  return nameArr
    .map((name, i) => ({ name: String(name || '').trim(), type: typeArr[i] || 'fixed' }))
    .filter((c) => c.name);
}

module.exports = {
  general,
  payroll,
  attendance,
  leave,
  appearance,
  audit,
  save,
};
