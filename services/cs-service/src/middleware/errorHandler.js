const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger(process.env.NODE_ID || 'CS');

/**
 * Centralized error handler. Any error passed via next(err) or thrown
 * inside an async route (caught by asyncHandler) ends up here instead
 * of crashing the process, satisfying the "one failed request should
 * not crash the service" requirement.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  logger.error('Unhandled error', { message: err.message, path: req.path });

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
  });
}

/**
 * Wraps an async route handler so rejected promises are forwarded to
 * errorHandler instead of causing an unhandled rejection.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
