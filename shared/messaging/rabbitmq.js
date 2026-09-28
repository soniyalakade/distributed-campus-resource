const amqp = require('amqplib');

/**
 * Shared RabbitMQ connection helper. Kept in shared/messaging/ (a new
 * folder, separate from shared/distributed/ which Phase 1 reserved for
 * clock/election logic only - see shared/distributed/*.js headers).
 *
 * Every service that touches RabbitMQ (department services publishing,
 * Gateway subscribing) goes through this single connect function so the
 * exchange name/type and reconnection behavior stay consistent.
 *
 * Design choice: ONE topic exchange, 'campus.resource.events', with
 * routing keys equal to the event type (e.g. 'RESOURCE_RESERVED'). This
 * matches shared/constants/events.js's EVENTS map directly - no
 * additional routing-key translation layer needed.
 */
const EXCHANGE_NAME = 'campus.resource.events';
const EXCHANGE_TYPE = 'topic';

// Phase 3 Step 3 addition: a SEPARATE fanout exchange for heartbeats,
// intentionally not mixed with the resource-events topic exchange
// above. Declared here (not a new connection module) so heartbeat
// traffic reuses the SAME connection/channel as resource events - no
// second amqp.connect() call anywhere in the system.
const HEARTBEAT_EXCHANGE_NAME = 'campus.node.heartbeat';
const HEARTBEAT_EXCHANGE_TYPE = 'fanout';

let connection = null;
let channel = null;

/**
 * Connects to RabbitMQ and asserts the shared exchange. Safe to call
 * multiple times - returns the cached channel after the first success.
 * Callers MUST wrap this in try/catch: a RabbitMQ outage must not crash
 * the calling service (per the existing error-handling convention used
 * for MongoDB/gRPC startup in server.js).
 */
async function getChannel(logger) {
  if (channel) {
    return channel;
  }

  const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: false });

  connection.on('error', (err) => {
    logger?.error('RabbitMQ connection error', { message: err.message });
    channel = null;
    connection = null;
  });
  connection.on('close', () => {
    logger?.warn('RabbitMQ connection closed');
    channel = null;
    connection = null;
  });

  return channel;
}

/**
 * Gets the shared channel (same connection/channel used for resource
 * events) and additionally asserts the heartbeat fanout exchange on
 * it. Idempotent - asserting an exchange that already exists with the
 * same type is a no-op. Kept separate from getChannel() itself so that
 * function's existing, already-tested behavior for resource events is
 * completely unchanged.
 */
async function assertHeartbeatExchange(logger) {
  const ch = await getChannel(logger);
  await ch.assertExchange(HEARTBEAT_EXCHANGE_NAME, HEARTBEAT_EXCHANGE_TYPE, { durable: false });
  return ch;
}

module.exports = {
  getChannel,
  assertHeartbeatExchange,
  EXCHANGE_NAME,
  EXCHANGE_TYPE,
  HEARTBEAT_EXCHANGE_NAME,
  HEARTBEAT_EXCHANGE_TYPE,
};
