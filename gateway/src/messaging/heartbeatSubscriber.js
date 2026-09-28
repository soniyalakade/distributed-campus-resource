const { assertHeartbeatExchange, HEARTBEAT_EXCHANGE_NAME } = require('../sharedPath').resolve('messaging/rabbitmq');
const { recordHeartbeat } = require('../services/livenessTable');

/**
 * Subscribes DIRECTLY to the RabbitMQ heartbeat fanout exchange, per
 * the explicit architecture requirement: the Gateway must not derive
 * liveness by polling each department's /internal/heartbeat over REST.
 * This is a SEPARATE queue/binding from messaging/subscriber.js (which
 * handles the resource-events topic exchange) - two independent
 * exclusive queues on the same shared channel/connection.
 *
 * Non-fatal on failure: if this can't be set up (RabbitMQ down at
 * Gateway startup), the liveness table simply stays UNKNOWN for every
 * department until a working subscription can be established - it
 * does not crash the Gateway or affect REST/gRPC/WS.
 */
async function startHeartbeatSubscriber(logger) {
  try {
    const channel = await assertHeartbeatExchange(logger);
    const { queue } = await channel.assertQueue('', { exclusive: true, autoDelete: true });
    await channel.bindQueue(queue, HEARTBEAT_EXCHANGE_NAME, '');

    channel.consume(
      queue,
      (msg) => {
        if (!msg) {
          return;
        }
        try {
          const parsed = JSON.parse(msg.content.toString());
          if (parsed.department) {
            recordHeartbeat(parsed.department, parsed.timestamp);
          } else {
            logger.warn('Received malformed heartbeat message (missing department)');
          }
        } catch (parseErr) {
          logger.warn('Failed to parse heartbeat message', { message: parseErr.message });
        }
      },
      { noAck: true }
    );

    logger.info('Gateway subscribed to RabbitMQ heartbeat fanout exchange');
  } catch (err) {
    logger.warn('Could not start heartbeat subscriber - liveness table will remain UNKNOWN', {
      message: err.message,
    });
  }
}

module.exports = { startHeartbeatSubscriber };
