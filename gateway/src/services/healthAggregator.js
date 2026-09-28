const axios = require('axios');
const { getNodes } = require('./nodeRegistry');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger('Gateway');
const HEALTH_TIMEOUT_MS = 1500;

/**
 * Polls every department node's /internal/health endpoint. Phase 2
 * scope only - this is a simple on-demand poll, not the beacon/heartbeat
 * mechanism (that arrives in Phase 6). A node that doesn't respond is
 * reported as DOWN rather than causing this endpoint to fail.
 */
async function checkAllNodesHealth() {
  const nodes = getNodes();

  const settled = await Promise.allSettled(
    nodes.map((node) =>
      axios
        .get(`${node.internalBase}/internal/health`, { timeout: HEALTH_TIMEOUT_MS })
        .then((response) => response.data)
    )
  );

  return settled.map((outcome, index) => {
    const department = nodes[index].department;
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }
    logger.warn('Health check failed for node', { department, reason: outcome.reason?.message });
    return { status: 'DOWN', nodeId: department, department, dbConnected: false };
  });
}

module.exports = { checkAllNodesHealth };
