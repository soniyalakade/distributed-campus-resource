const { getChannel, EXCHANGE_NAME } = require('../sharedPath').resolve('messaging/rabbitmq');
const { broadcast } = require('../ws/wsRelay');

/**
 * Subscribes to ALL routing keys on the shared topic exchange ('#'
 * wildcard binding) via an exclusive, auto-delete queue - the Gateway
 * doesn't need a durable named queue since it only cares about events
 * that occur while it's connected (live relay, not an audit log).
 *
 * Every message received is forwarded to connected WebSocket clients
 * unchanged. If RabbitMQ is unavailable, this fails silently (logged,
 * not thrown) - the REST/gRPC APIs and WebSocket connections themselves
 * are completely unaffected by the absence of live event updates.
 */
async function startSubscriber(logger) {
  try {
    const channel = await getChannel(logger);
    const { queue } = await channel.assertQueue('', { exclusive: true, autoDelete: true });
    await channel.bindQueue(queue, EXCHANGE_NAME, '#');

    channel.consume(
      queue,
      (msg) => {
        if (!msg) {
          return;
        }
        try {
          const parsed = JSON.parse(msg.content.toString());
          logger.info(`Relaying event ${parsed.eventType} to WebSocket clients`, {
            department: parsed.payload?.department,
          });
          broadcast(parsed);
        } catch (parseErr) {
          logger.warn('Failed to parse RabbitMQ message', { message: parseErr.message });
        }
      },
      { noAck: true }
    );

    logger.info('Gateway subscribed to RabbitMQ exchange for WS relay');
  } catch (err) {
    logger.warn('Could not start RabbitMQ subscriber - WebSocket relay will have no live events', {
      message: err.message,
    });
  }
}

module.exports = { startSubscriber };
