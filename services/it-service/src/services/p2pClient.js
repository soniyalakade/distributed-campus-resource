const axios = require('axios');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const NODE_ID = process.env.NODE_ID || 'IT';
const THIS_DEPARTMENT = process.env.DEPARTMENT || 'IT';
const logger = createLogger(NODE_ID);

const P2P_TIMEOUT_MS = 2000;

/**
 * Peer address registry for THIS service's P2P client, following the
 * exact same *_SERVICE_URL naming convention already used by the
 * Gateway's nodeRegistry.js - not a new configuration scheme. IT's own
 * entry is intentionally excluded: a service never P2P-calls itself.
 */
const PEERS = [
  { department: 'CS', internalBase: process.env.CS_SERVICE_URL || 'http://localhost:5001' },
  { department: 'ENTC', internalBase: process.env.ENTC_SERVICE_URL || 'http://localhost:5003' },
];

function getPeers(targetDepartments) {
  if (!targetDepartments || targetDepartments.length === 0) {
    return PEERS;
  }
  const wanted = new Set(targetDepartments.map((d) => d.trim().toUpperCase()));
  return PEERS.filter((p) => wanted.has(p.department));
}

/**
 * Calls a single peer's /internal/p2p/availability endpoint directly
 * over HTTP - genuine department-to-department communication, not
 * routed through the Gateway, RabbitMQ, or gRPC. Forwards the caller's
 * Authorization header unchanged, since the peer's jwtAuth middleware
 * requires it (same JWT_SECRET, same verification as every other
 * internal route - no new auth mechanism).
 */
async function checkPeerAvailability(peer, search, authHeader) {
  try {
    const response = await axios.get(`${peer.internalBase}/internal/p2p/availability`, {
      params: { search },
      headers: { Authorization: authHeader },
      timeout: P2P_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    logger.warn(`P2P call to ${peer.department} failed`, { message: err.message });
    return {
      department: peer.department,
      status: 'UNREACHABLE',
      available: false,
      matches: [],
    };
  }
}

/**
 * Fans out to the requested (or all known) peers concurrently and
 * aggregates their availability responses. One unreachable peer never
 * fails the whole check - each call is independently caught above.
 */
async function checkPeersAvailability(search, targetDepartments, authHeader) {
  const peers = getPeers(targetDepartments);
  logger.info('P2P availability check started', { requestingDepartment: THIS_DEPARTMENT, search, targets: peers.map((p) => p.department) });

  const results = await Promise.all(peers.map((peer) => checkPeerAvailability(peer, search, authHeader)));

  return {
    requestingDepartment: THIS_DEPARTMENT,
    search,
    results,
  };
}

module.exports = { checkPeersAvailability };
