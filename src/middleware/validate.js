const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs express-validator chains, returning a 400 with structured
 * field errors when validation fails.
 */
function validate(req, _res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  return next(ApiError.badRequest('Validation failed', details));
}

module.exports = validate;
