const resourceService = require('../services/resourceService');
const { verifyGrpcAuth } = require('./grpcAuth');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const NODE_ID = process.env.NODE_ID || 'ENTC';
const DEPARTMENT = process.env.DEPARTMENT || 'ENTC';
const logger = createLogger(NODE_ID);

/**
 * gRPC handler for ResourceService.SearchResource.
 *
 * Deliberately calls the SAME resourceService.searchResourcesByName used
 * by the existing REST endpoint (GET /internal/resources?search=) rather
 * than writing a second Mongo query - this guarantees gRPC and REST
 * return identical data for the same query, and means this service's
 * own cs_db is queried, never another department's database.
 */
async function searchResource(call, callback) {
  const { query, requestingNodeId } = call.request;
  logger.info('gRPC SearchResource received', { query, requestingNodeId });

  try {
    verifyGrpcAuth(call);
  } catch (authErr) {
    logger.warn('gRPC SearchResource unauthorized', { message: authErr.message });
    return callback(null, {
      status: 2, // UNAUTHORIZED
      department: DEPARTMENT,
      matches: [],
      totalAvailable: 0,
      errorMessage: authErr.message,
    });
  }

  try {
    const matches = await resourceService.searchResourcesByName(query);

    const totalAvailable = matches.reduce((sum, r) => sum + (r.availableQuantity || 0), 0);

    const response = {
      status: 0, // SUCCESS
      department: DEPARTMENT,
      matches: matches.map((r) => ({
        resourceId: r.resourceId,
        name: r.name,
        category: r.category,
        department: r.department,
        laboratory: r.laboratory || '',
        totalQuantity: r.totalQuantity,
        availableQuantity: r.availableQuantity,
        reservedQuantity: r.reservedQuantity,
        borrowedQuantity: r.borrowedQuantity,
        condition: r.condition || '',
      })),
      totalAvailable,
      errorMessage: '',
    };

    callback(null, response);
  } catch (err) {
    logger.error('gRPC SearchResource failed', { message: err.message });
    callback(null, {
      status: 1, // INTERNAL_ERROR
      department: DEPARTMENT,
      matches: [],
      totalAvailable: 0,
      errorMessage: err.message,
    });
  }
}

module.exports = { searchResource };
