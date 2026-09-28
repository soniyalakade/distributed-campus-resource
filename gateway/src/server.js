require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const borrowRoutes = require('./routes/borrowRoutes');
const nodeRoutes = require('./routes/nodeRoutes');
const distributedRoutes = require('./routes/distributedRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const { createLogger } = require('./sharedPath').resolve('utils/logger');
const { attachWebSocketServer } = require('./ws/wsRelay');
const { startSubscriber } = require('./messaging/subscriber');
const { startHeartbeatSubscriber } = require('./messaging/heartbeatSubscriber');

const PORT = process.env.GATEWAY_PORT || 4000;
const AUTH_MONGO_URI = process.env.AUTH_MONGO_URI || 'mongodb://localhost:27017/auth_db';

const logger = createLogger('Gateway');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/resources', resourceRoutes); // GET /search, GET /:id
app.use('/api/resources', borrowRoutes); // POST /:id/borrow, POST /:id/return
app.use('/api/borrow', borrowRoutes); // GET /my (same router, additional mount point)
app.use('/api/reservations', reservationRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/distributed', distributedRoutes);
app.use('/api/admin', adminRoutes);

// Simple liveness endpoint for the Gateway itself (used by Docker healthcheck).
app.get('/health', (req, res) => res.json({ status: 'UP', service: 'gateway' }));

app.use(errorHandler);

async function start() {
  try {
    await mongoose.connect(AUTH_MONGO_URI);
    logger.info(`Connected to Auth MongoDB at ${AUTH_MONGO_URI}`);

    const httpServer = app.listen(PORT, () => {
      logger.info(`Gateway listening on port ${PORT}`);
    });

    // WebSocket relay attaches to the SAME http.Server/port as REST -
    // does not open a new port, does not touch any existing REST route.
    attachWebSocketServer(httpServer, logger);

    // RabbitMQ subscription is independent of Mongo/REST/WS startup
    // succeeding - its own internal try/catch (see subscriber.js) means
    // a RabbitMQ outage here only disables live event relay, nothing else.
    await startSubscriber(logger);

    // Separate subscription to the heartbeat fanout exchange (distinct
    // queue/binding from the resource-events subscriber above). This
    // is what feeds the liveness table backing /api/distributed/heartbeat -
    // the Gateway does NOT poll department nodes over REST for this.
    await startHeartbeatSubscriber(logger);
  } catch (err) {
    logger.error('Failed to start gateway', { message: err.message });
    process.exit(1);
  }
}

start();

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
