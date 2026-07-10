/**
 * Centralized environment configuration.
 * All env access goes through this module so the rest of the app
 * never reads process.env directly and we get typed defaults.
 */
require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV !== 'production',
  port: parseInt(process.env.PORT, 10) || 3000,
  appName: process.env.APP_NAME || 'HRM System',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hrm_system',

  sessionSecret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
  sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 24 * 60 * 60 * 1000, // 1 day

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  cookieSecure: process.env.COOKIE_SECURE === 'true',

  // Upload directory — resolved to an ABSOLUTE path (env-independent).
  // Honors UPLOAD_DIR env override; otherwise uses src/public/uploads.
  uploadDir: process.env.UPLOAD_DIR
    ? require('path').resolve(process.env.UPLOAD_DIR)
    : require('./paths').UPLOADS,
  maxFileBytes: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5) * 1024 * 1024,

  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};

module.exports = Object.freeze(env);
