const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger('Gateway');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  logger.error('Unhandled error', { message: err.message, path: req.path });

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
