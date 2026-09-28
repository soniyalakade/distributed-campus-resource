const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { resolveProtoPath } = require('../grpc/protoPath');

let proto = null;
const clientCache = new Map();

function loadProto() {
  if (proto) {
    return proto;
  }
  const protoPath = resolveProtoPath('resource.proto');
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: Number,
    defaults: true,
    oneofs: true,
  });
  proto = grpc.loadPackageDefinition(packageDefinition).campusresource;
  return proto;
}

/**
 * Returns a cached ResourceService client stub for the given address,
 * creating it on first use. Reusing clients (rather than creating a new
 * one per request) is standard gRPC practice - connections are
 * long-lived and multiplexed.
 */
function getResourceServiceClient(address) {
  if (clientCache.has(address)) {
    return clientCache.get(address);
  }
  const pkg = loadProto();
  const client = new pkg.ResourceService(address, grpc.credentials.createInsecure());
  clientCache.set(address, client);
  return client;
}

module.exports = { getResourceServiceClient };
