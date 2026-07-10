const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { User } = require('../models');

/**
 * Passport local strategy using email + password against the User model.
 * Users are linked to Employee records; role drives authorization.
 */
passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email: email.toLowerCase().trim() })
          .populate('employee', 'employeeId firstName lastName')
          .select('+password +status');

        if (!user) return done(null, false, { message: 'Invalid email or password.' });
        if (user.status !== 'active') return done(null, false, { message: 'Your account is not active. Contact an administrator.' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return done(null, false, { message: 'Invalid email or password.' });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id)
      .populate('employee', 'employeeId firstName lastName avatar')
      .select('-password');
    if (!user) return done(null, false);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
