require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const resourceRoutes = require('./routes/resourceRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const healthRoutes = require('./routes/healthRoutes');
const p2pRoutes = require('./routes/p2pRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const { createLogger } = require('./sharedPath').resolve('utils/logger');
const { getChannel } = require('./sharedPath').resolve('messaging/rabbitmq');
const { startGrpcServer } = require('./grpc/server');
const { startHeartbeatPublisher } = require('./messaging/heartbeatPublisher');

const NODE_ID = process.env.NODE_ID || 'ENTC';
const DEPARTMENT = process.env.DEPARTMENT || 'ENTC';
const PORT = process.env.PORT || 5003;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/entc_db';

const logger = createLogger(NODE_ID);

const app = express();
app.use(cors());
app.use(express.json());

// Route mounting - note the internal/ prefix is applied by the caller's
// path convention (Gateway calls http://cs-service:5001/internal/...).
app.use('/internal/resources', resourceRoutes);
app.use('/internal', reservationRoutes); // exposes /internal/reservations, /internal/resources/:id/borrow|return
app.use('/internal/health', healthRoutes);
app.use('/internal/p2p', p2pRoutes);

// Error handler must be registered last.
app.use(errorHandler);

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info(`Connected to MongoDB at ${MONGO_URI}`);

    app.listen(PORT, () => {
      logger.info(`${DEPARTMENT} service listening on port ${PORT}`);
    });

    // gRPC runs as a second listener in this same process, alongside
    // (not instead of) the REST server above - Phase 3 Step 1 requirement
    // that the existing REST API must keep working unchanged.
    startGrpcServer();

    // RabbitMQ connection is established eagerly at startup (so the
    // first publish() call doesn't pay a connection-setup delay), but
    // its failure is INTENTIONALLY non-fatal - wrapped in its own
    // try/catch, separate from the Mongo connect above which IS fatal.
    // Every publish() call later also independently swallows failures
    // (see shared/messaging/eventPublisher.js), so even if RabbitMQ
    // goes down mid-run, resource/reservation/borrow/return operations
    // keep working exactly as they did before this step.
    try {
      await getChannel(logger);
      logger.info(`Connected to RabbitMQ at ${process.env.RABBITMQ_URL || 'amqp://localhost:5672'}`);
    } catch (mqErr) {
      logger.warn('RabbitMQ unavailable at startup - service will continue without eventing', {
        message: mqErr.message,
      });
    }

    startHeartbeatPublisher();
  } catch (err) {
    logger.error('Failed to start service', { message: err.message });
    process.exit(1);
  }
}

start();

// Prevent one unexpected rejection from silently killing the process
// without a log line - still exits, but with visibility for debugging.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
