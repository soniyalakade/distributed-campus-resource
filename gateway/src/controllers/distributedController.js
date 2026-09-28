const { getLivenessTable } = require('../services/livenessTable');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger('Gateway');

/**
 * Returns the Gateway's own in-memory liveness table, populated purely
 * by consuming the RabbitMQ heartbeat fanout exchange (see
 * messaging/heartbeatSubscriber.js). This endpoint does NOT make any
 * outbound REST calls to CS/IT/ENTC - the whole point of this
 * architecture is that liveness is derived from the message bus, not
 * from polling.
 */
async function getHeartbeat(req, res) {
  logger.info('Distributed heartbeat table requested');
  const peers = getLivenessTable();
  res.json({ peers });
}

module.exports = { getHeartbeat };
