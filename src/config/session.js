const MongoStore = require('connect-mongo');
const env = require('./env');

/**
 * Express session configuration backed by MongoDB so sessions
 * survive process restarts. Cookies are httpOnly and signed.
 */
const sessionConfig = {
  name: 'hrm.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: env.mongodbUri,
    collectionName: 'sessions',
    ttl: env.sessionMaxAge / 1000,
  }),
  cookie: {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge: env.sessionMaxAge,
  },
};

module.exports = sessionConfig;
