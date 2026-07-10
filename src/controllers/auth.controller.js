const passport = require('../config/passport');
const asyncHandler = require('../utils/asyncHandler');
const auditLog = require('../middleware/audit');
const authLimiter = require('../middleware/rateLimit').authLimiter;

function login(req, res) {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Sign In', layout: false });
}

const authenticate = [
  authLimiter,
  (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        req.flash('error', info?.message || 'Login failed.');
        return res.redirect('/login');
      }
      req.logIn(user, async (err) => {
        if (err) return next(err);
        await auditLog(req, {
          action: 'auth.login',
          module: 'auth',
          description: `${user.email} signed in`,
          status: 'success',
        });
        req.flash('success', `Welcome back, ${user.name}!`);
        const returnTo = req.session.returnTo || '/dashboard';
        delete req.session.returnTo;
        res.redirect(returnTo);
      });
    })(req, res, next);
  },
];

const logout = asyncHandler(async (req, res, next) => {
  await auditLog(req, { action: 'auth.logout', module: 'auth', description: `${req.user?.email} signed out` });
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('hrm.sid');
      res.redirect('/login');
    });
  });
});

module.exports = { login, authenticate, logout };
