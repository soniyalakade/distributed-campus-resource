const { getChannel, EXCHANGE_NAME } = require('./rabbitmq');

/**
 * Publishes a single event to the shared topic exchange. Routing key
 * equals the event type itself (see shared/constants/events.js), so a
 * consumer can subscribe to a wildcard binding ('#') to receive
 * everything, or a specific key to receive one event type only.
 *
 * Never throws to the caller - a publish failure (RabbitMQ down, etc.)
 * is logged and swallowed, consistent with the "RabbitMQ down must not
 * crash the service" requirement. Callers should NOT wrap this in their
 * own try/catch; it's already safe to call unconditionally.
 */
async function publishEvent(eventType, payload, logger) {
  try {
    const ch = await getChannel(logger);
    const message = Buffer.from(JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() }));
    ch.publish(EXCHANGE_NAME, eventType, message);
    logger?.info(`Published event ${eventType}`, { payload });
  } catch (err) {
    logger?.warn(`Failed to publish event ${eventType} (RabbitMQ unavailable?)`, { message: err.message });
  }
}

module.exports = { publishEvent };
