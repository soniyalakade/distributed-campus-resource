const WebSocket = require('ws');

let wss = null;

/**
 * Attaches a WebSocket server to the SAME http.Server instance Express
 * is already using (returned by app.listen()) on the path /ws/updates,
 * per the WS endpoint documented in PHASE1_ARCHITECTURE.md section 9.
 * This does not open a new port - browsers connect to
 * ws://localhost:4000/ws/updates, same host/port as the REST API.
 */
function attachWebSocketServer(httpServer, logger) {
  wss = new WebSocket.Server({ server: httpServer, path: '/ws/updates' });

  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected', { totalClients: wss.clients.size });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected', { totalClients: wss.clients.size });
    });

    ws.on('error', (err) => {
      logger.warn('WebSocket client error', { message: err.message });
    });
  });

  logger.info('WebSocket relay attached at /ws/updates');
  return wss;
}

/**
 * Broadcasts a message to every currently-connected WebSocket client.
 * Called by messaging/subscriber.js whenever a RabbitMQ event arrives.
 * Silently does nothing if no clients are connected or the WS server
 * hasn't been attached yet - this must never throw and break the
 * RabbitMQ consumer loop.
 */
function broadcast(message) {
  if (!wss) {
    return;
  }
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

module.exports = { attachWebSocketServer, broadcast };
