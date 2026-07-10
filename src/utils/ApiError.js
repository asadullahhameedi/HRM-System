/**
 * Operational error with optional HTTP status code.
 * Thrown by services/controllers and caught by the error middleware.
 */
class ApiError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', details = null) {
    return new ApiError(msg, 400, details);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new ApiError(msg, 401);
  }
  static forbidden(msg = 'Forbidden') {
    return new ApiError(msg, 403);
  }
  static notFound(msg = 'Resource not found') {
    return new ApiError(msg, 404);
  }
  static conflict(msg = 'Resource already exists') {
    return new ApiError(msg, 409);
  }
}

module.exports = ApiError;
