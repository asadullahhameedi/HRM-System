const express = require('express');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const passport = require('./config/passport');
const sessionConfig = require('./config/session');
const env = require('./config/env');
const paths = require('./config/paths');
const logger = require('./utils/logger');
const { locals } = require('./middleware/flash');
const debugLogger = require('./middleware/debug');
const { errorHandler, notFound } = require('./middleware/error');
const { apiLimiter } = require('./middleware/rateLimit');

// Ensure the uploads directory exists before the app starts handling requests.
// This prevents ENOENT errors when files are uploaded or served.
paths.ensureUploadsDir();

// Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const employeeRoutes = require('./routes/employee.routes');
const masterRoutes = require('./routes/master.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const payrollRoutes = require('./routes/payroll.routes');
const taskRoutes = require('./routes/task.routes');
const documentRoutes = require('./routes/document.routes');
const profileRoutes = require('./routes/profile.routes');
const aboutRoutes = require('./routes/about.routes');
const userRoutes = require('./routes/user.routes');
const settingsRoutes = require('./routes/settings.routes');
const reportsRoutes = require('./routes/reports.routes');

const app = express();

// ---- View engine ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.use(expressLayouts);

// ---- Security & parsing ----
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(morgan(env.isProd ? 'combined' : 'dev', { stream: { write: (m) => logger.info(m.trim()) } }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// ---- Static ----
// Serve uploaded files from the centralized UPLOADS directory.
// - Path traversal is blocked (req.path is sanitized against the uploads root).
// - Missing files return a clean 404 instead of crashing to a 500.
// - res.sendFile has an error callback so it never throws unhandled.
app.use('/uploads', (req, res, next) => {
  // Normalize and guard against path traversal (..) and absolute paths.
  const requested = paths.normalizeStoredPath(req.path);
  if (!requested) {
    return res.status(404).send('File not found');
  }
  const filePath = path.join(paths.UPLOADS, requested);

  // Extra guard: the resolved path must still be inside UPLOADS
  if (!filePath.startsWith(paths.UPLOADS + path.sep) && filePath !== paths.UPLOADS) {
    return res.status(404).send('File not found');
  }

  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) return res.status(404).send('File not found');
    res.sendFile(filePath, (sendErr) => {
      if (sendErr && sendErr.code !== 'ECONNABORTED' && sendErr.code !== 'EPIPE') {
        // File disappeared between the access check and the send — log & 404
        logger.warn(`Failed to send uploaded file ${filePath}: ${sendErr.message}`);
        if (!res.headersSent) res.status(404).send('File not found');
      }
    });
  });
});
app.use(express.static(path.join(__dirname, 'public')));
// Only expose the Font Awesome package from node_modules — exposing the
// entire node_modules folder leaked every dependency's package.json (and
// any non-JS assets) to the public internet.
app.use('/vendor/@fortawesome', express.static(path.join(paths.ROOT, 'node_modules/@fortawesome')));

// ---- Sessions & auth ----
app.use(session(sessionConfig));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// ---- Global locals ----
app.use(locals);
app.use(debugLogger);

// ---- Rate limiting (global API only) ----
app.use('/api', apiLimiter);

// ---- Routes ----
app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/employees', employeeRoutes);
app.use('/', masterRoutes); // /departments, /designations
app.use('/', attendanceRoutes); // /attendance, /leave, /holidays
app.use('/payroll', payrollRoutes);
app.use('/tasks', taskRoutes);
app.use('/documents', documentRoutes);
app.use('/users', userRoutes);
app.use('/profile', profileRoutes);
app.use('/about', aboutRoutes);
app.use('/settings', settingsRoutes);
app.use('/reports', reportsRoutes);

// ---- Errors ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
