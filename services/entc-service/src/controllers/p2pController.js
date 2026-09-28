const resourceService = require('../services/resourceService');
const p2pClient = require('../services/p2pClient');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const NODE_ID = process.env.NODE_ID || 'ENTC';
const DEPARTMENT = process.env.DEPARTMENT || 'ENTC';
const logger = createLogger(NODE_ID);

/**
 * GET /internal/p2p/availability?search=Arduino
 *
 * The RECEIVING side of a P2P call. Queries ONLY this department's own
 * MongoDB via the existing resourceService.searchResourcesByName - the
 * exact same function the regular /internal/resources search endpoint
 * already uses. Never calls the Gateway, never calls another
 * department - a pure, self-contained local lookup.
 */
async function availability(req, res) {
  const { search } = req.query;
  logger.info('P2P availability request received', { search, from: req.headers['x-p2p-source'] || 'unknown' });

  const matches = await resourceService.searchResourcesByName(search);
  const available = matches.some((r) => r.availableQuantity > 0);

  res.json({
    department: DEPARTMENT,
    available,
    matches: matches.map((r) => ({
      resourceId: r.resourceId,
      name: r.name,
      availableQuantity: r.availableQuantity,
    })),
  });
}

/**
 * GET /internal/p2p/check?search=Arduino&targets=IT,ENTC
 *
 * The INITIATING side. This department directly contacts the requested
 * peer(s) over HTTP (see p2pClient.js) and aggregates their responses.
 * This is a demonstration endpoint only - it is NOT a second Gateway
 * search implementation and does not affect /api/resources/search.
 */
async function check(req, res) {
  const { search, targets } = req.query;
  const targetDepartments = targets ? targets.split(',') : [];

  const authHeader = req.headers.authorization;
  const result = await p2pClient.checkPeersAvailability(search, targetDepartments, authHeader);
  res.json(result);
}

module.exports = { availability, check };
