/**
 * Expose flash messages and common locals to every EJS view so partials
 * (header, sidebar, footer, flash) can render without each controller
 * repeating the same data.
 *
 * Settings are loaded from the DB-backed Setting model (one document per
 * scope: general / payroll / attendance / leave / appearance). For any
 * key missing from the DB, values fall back to config/settingsDefaults.js
 * → config/defaults.js. A short-lived in-process cache (in settings.service)
 * avoids hitting MongoDB on every request.
 */
const defaults = require('../config/defaults');
const settingsService = require('../services/settings.service');

async function locals(req, res, next) {
  // Theme: user session override > appearance default
  let theme = req.session?.theme;
  try {
    const all = await settingsService.loadAll();
    if (!theme) theme = all.appearance?.defaultTheme || defaults.defaultTheme || 'system';
    res.locals.theme = theme;

    // Full settings map (every scope, merged with defaults)
    res.locals.settingsMap = all;
    res.locals.settings = { ...defaults, ...all.general, ...all.payroll, ...all.attendance, ...all.leave };

    // Convenience locals (commonly used in views)
    const g = all.general || {};
    res.locals.appName = g.companyName || defaults.companyName;
    res.locals.currencySymbol = g.currencySymbol || defaults.currencySymbol;
    res.locals.currency = g.currency || defaults.currency;
    res.locals.companyName = g.companyName || defaults.companyName;
    res.locals.companyLogo = g.companyLogo || null;
    res.locals.companyEmail = g.companyEmail || defaults.companyEmail;
    res.locals.companyPhone = g.companyPhone || defaults.companyPhone;
    res.locals.companyAddress = g.address || defaults.address;
    res.locals.companyTaxNumber = g.taxNumber || '';
    res.locals.companyRegistrationNumber = g.registrationNumber || '';
    res.locals.timeZone = g.timeZone || defaults.timeZone;
    res.locals.dateFormat = g.dateFormat || defaults.dateFormat;

    // Appearance locals (consumed by layouts/main.ejs to inject CSS vars)
    res.locals.primaryColor = all.appearance?.primaryColor || '#164bdc';
    res.locals.secondaryColor = all.appearance?.secondaryColor || '#0ea5e9';
    res.locals.accentColor = all.appearance?.accentColor || '#8b5cf6';
    res.locals.successColor = all.appearance?.successColor || '#10b981';
    res.locals.warningColor = all.appearance?.warningColor || '#f59e0b';
    res.locals.errorColor = all.appearance?.errorColor || '#ef4444';
    res.locals.infoColor = all.appearance?.infoColor || '#06b6d4';
    res.locals.sidebarColor = all.appearance?.sidebarColor || '#0f172a';
    res.locals.headerColor = all.appearance?.headerColor || '#164bdc';
    res.locals.backgroundColor = all.appearance?.backgroundColor || '#f8fafc';
    res.locals.cardColor = all.appearance?.cardColor || '#ffffff';
    res.locals.sidebarStyle = all.appearance?.sidebarStyle || 'dark';
    res.locals.sidebarPosition = all.appearance?.sidebarPosition || 'left';
    res.locals.sidebarWidth = all.appearance?.sidebarWidth || 'default';
    res.locals.layoutWidth = all.appearance?.layoutWidth || 'boxed';
    res.locals.fontFamily = all.appearance?.fontFamily || 'Inter';
    res.locals.fontSize = all.appearance?.fontSize || '14px';
    res.locals.borderRadius = all.appearance?.borderRadius || '0.5rem';
    res.locals.cardStyle = all.appearance?.cardStyle || 'shadow';
    res.locals.shadowStyle = all.appearance?.shadowStyle || 'soft';
    res.locals.layoutDensity = all.appearance?.layoutDensity || 'comfortable';
    res.locals.rtlEnabled = all.appearance?.rtlEnabled || false;
  } catch (e) {
    // DB unavailable (e.g. during testing) — fall back to hardcoded defaults
    if (!theme) theme = defaults.defaultTheme || 'system';
    res.locals.theme = theme;
    res.locals.settingsMap = {};
    res.locals.settings = defaults;
    res.locals.appName = defaults.companyName;
    res.locals.currencySymbol = defaults.currencySymbol;
    res.locals.currency = defaults.currency;
    res.locals.companyName = defaults.companyName;
    res.locals.companyLogo = defaults.companyLogo;
    res.locals.companyEmail = defaults.companyEmail;
    res.locals.companyPhone = defaults.companyPhone;
    res.locals.companyAddress = defaults.address;
    res.locals.companyTaxNumber = '';
    res.locals.companyRegistrationNumber = '';
    res.locals.timeZone = defaults.timeZone;
    res.locals.dateFormat = defaults.dateFormat;
    res.locals.primaryColor = '#164bdc';
    res.locals.secondaryColor = '#0ea5e9';
    res.locals.accentColor = '#8b5cf6';
    res.locals.successColor = '#10b981';
    res.locals.warningColor = '#f59e0b';
    res.locals.errorColor = '#ef4444';
    res.locals.infoColor = '#06b6d4';
    res.locals.sidebarColor = '#0f172a';
    res.locals.headerColor = '#164bdc';
    res.locals.backgroundColor = '#f8fafc';
    res.locals.cardColor = '#ffffff';
    res.locals.sidebarStyle = 'dark';
    res.locals.sidebarPosition = 'left';
    res.locals.sidebarWidth = 'default';
    res.locals.layoutWidth = 'boxed';
    res.locals.fontFamily = 'Inter';
    res.locals.fontSize = '14px';
    res.locals.borderRadius = '0.5rem';
    res.locals.cardStyle = 'shadow';
    res.locals.shadowStyle = 'soft';
    res.locals.layoutDensity = 'comfortable';
    res.locals.rtlEnabled = false;
  }

  res.locals.flash = {
    success: req.flash('success'),
    error: req.flash('error'),
    warning: req.flash('warning'),
    info: req.flash('info'),
  };

  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  res.locals.year = new Date().getFullYear();

  next();
}

module.exports = { locals };
