/**
 * Static registry of department node base URLs, read from environment
 * variables. This is intentionally simple for Phase 2 - no dynamic
 * service discovery yet, just a fixed list the Gateway fans requests
 * out to. Each entry's `internalBase` points at that service's
 * /internal REST API (see services/<dept>-service/src/server.js).
 */
const NODES = [
  {
    department: 'CS',
    internalBase: process.env.CS_SERVICE_URL || 'http://localhost:5001',
  },
  {
    department: 'IT',
    internalBase: process.env.IT_SERVICE_URL || 'http://localhost:5002',
  },
  {
    department: 'ENTC',
    internalBase: process.env.ENTC_SERVICE_URL || 'http://localhost:5003',
  },
];

function getNodes() {
  return NODES;
}

function getNodeByDepartment(department) {
  return NODES.find((n) => n.department === department) || null;
}

module.exports = { getNodes, getNodeByDepartment };
