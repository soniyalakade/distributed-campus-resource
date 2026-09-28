const { assertHeartbeatExchange, HEARTBEAT_EXCHANGE_NAME } = require('../sharedPath').resolve('messaging/rabbitmq');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const NODE_ID = process.env.NODE_ID || 'ENTC';
const DEPARTMENT = process.env.DEPARTMENT || 'ENTC';
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS) || 5000;

const logger = createLogger(NODE_ID);

let intervalHandle = null;

/**
 * Publishes one heartbeat beacon. Never throws - a publish failure
 * (RabbitMQ down) is logged and swallowed, matching the exact
 * non-fatal philosophy already used for resource events
 * (shared/messaging/eventPublisher.js). This must never affect REST,
 * gRPC, or MongoDB operations.
 */
async function publishHeartbeat() {
  try {
    const channel = await assertHeartbeatExchange(logger);
    const message = Buffer.from(
      JSON.stringify({ department: DEPARTMENT, timestamp: new Date().toISOString(), status: 'ALIVE' })
    );
    // Fanout exchanges ignore the routing key - '' is conventional.
    channel.publish(HEARTBEAT_EXCHANGE_NAME, '', message);
  } catch (err) {
    logger.warn('Heartbeat publish failed', { message: err.message });
  }
}

/**
 * Starts the periodic beacon. Fires one immediately (so the Gateway
 * doesn't wait a full interval after this service starts before
 * learning it's alive), then repeats every HEARTBEAT_INTERVAL_MS.
 */
function startHeartbeatPublisher() {
  publishHeartbeat();
  intervalHandle = setInterval(publishHeartbeat, HEARTBEAT_INTERVAL_MS);
  logger.info(`Heartbeat publisher started (interval=${HEARTBEAT_INTERVAL_MS}ms)`);
}

function stopHeartbeatPublisher() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { startHeartbeatPublisher, stopHeartbeatPublisher };
