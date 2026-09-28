const searchAggregator = require('../services/searchAggregator');
const grpcSearchAggregator = require('../services/grpcSearchAggregator');
const resourceProxyService = require('../services/resourceProxyService');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger('Gateway');

async function search(req, res) {
  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: 'Query parameter "name" is required' });
  }
  logger.info('Search request', { name });
  const result = await searchAggregator.searchAcrossNodes(name, req.authHeader);
  res.json(result);
}

/**
 * gRPC-backed equivalent of `search` above, added for Phase 3 Step 1.
 * Deliberately a SEPARATE endpoint (GET /api/resources/search-grpc)
 * rather than replacing GET /api/resources/search, per the explicit
 * instruction to keep the existing REST-fan-out search working
 * unmodified while gRPC is introduced alongside it.
 */
async function searchGrpc(req, res) {
  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: 'Query parameter "name" is required' });
  }
  logger.info('gRPC search request', { name });
  const result = await grpcSearchAggregator.searchAcrossNodesGrpc(name, req.authHeader);
  res.json(result);
}

async function getOne(req, res) {
  const resource = await resourceProxyService.getResourceById(req.params.id, req.authHeader);
  res.json(resource);
}

module.exports = { search, searchGrpc, getOne };
