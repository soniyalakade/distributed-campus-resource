const mongoose = require('mongoose');

const NODE_ID = process.env.NODE_ID || 'ENTC';
const DEPARTMENT = process.env.DEPARTMENT || 'ENTC';

/**
 * Basic health check. Phase 2 scope only - no heartbeat/beacon logic
 * yet (that's Phase 6). This just reports whether the process is up
 * and whether its own MongoDB connection is currently connected.
 */
async function health(req, res) {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.json({
    status: dbState === 1 ? 'UP' : 'DEGRADED',
    nodeId: NODE_ID,
    department: DEPARTMENT,
    dbConnected: dbState === 1,
  });
}

module.exports = { health };
