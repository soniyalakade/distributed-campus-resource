const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { resolveProtoPath } = require('./protoPath');
const { searchResource } = require('./searchHandler');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const NODE_ID = process.env.NODE_ID || 'CS';
const GRPC_PORT = process.env.GRPC_PORT || 6001;
const logger = createLogger(NODE_ID);

/**
 * Starts the gRPC server for this department node. Runs ALONGSIDE the
 * existing Express/REST server (started separately in server.js) - this
 * is a second listener in the same process, not a replacement.
 */
function startGrpcServer() {
  const protoPath = resolveProtoPath('resource.proto');
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: Number,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDefinition).campusresource;

  const server = new grpc.Server();
  server.addService(proto.ResourceService.service, {
    SearchResource: searchResource,
  });

  server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      logger.error('Failed to start gRPC server', { message: err.message });
      return;
    }
    logger.info(`gRPC server listening on port ${port}`);
  });

  return server;
}

module.exports = { startGrpcServer };
