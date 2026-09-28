/**
 * gRPC address registry, deliberately kept SEPARATE from the existing
 * REST nodeRegistry.js (services/gateway/src/services/nodeRegistry.js)
 * rather than merged into it, so the REST search path is untouched.
 *
 * Port convention (documented, via env vars):
 *   CS REST 5001   / CS gRPC 6001
 *   IT REST 5002   / IT gRPC 6002
 *   ENTC REST 5003 / ENTC gRPC 6003
 */
const GRPC_NODES = [
  {
    department: 'CS',
    address: process.env.CS_GRPC_ADDRESS || 'localhost:6001',
  },
  {
    department: 'IT',
    address: process.env.IT_GRPC_ADDRESS || 'localhost:6002',
  },
  {
    department: 'ENTC',
    address: process.env.ENTC_GRPC_ADDRESS || 'localhost:6003',
  },
];

function getGrpcNodes() {
  return GRPC_NODES;
}

module.exports = { getGrpcNodes };
