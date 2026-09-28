const { DEPARTMENTS } = require('../sharedPath').resolve('constants/departments');

const HEARTBEAT_TIMEOUT_MS = Number(process.env.HEARTBEAT_TIMEOUT_MS) || 15000;

/**
 * The Gateway's own liveness table, per your explicit architecture
 * requirement: the Gateway subscribes directly to the RabbitMQ
 * heartbeat fanout exchange and maintains this table itself - it does
 * NOT poll /internal/heartbeat on each department service.
 *
 * Initial status is UNKNOWN (not DEAD) until the first heartbeat
 * arrives, avoiding a false-DEAD reading in the first few seconds
 * after the Gateway starts, before any department has had a chance
 * to publish.
 */
const peers = {};
for (const dept of DEPARTMENTS) {
  peers[dept] = { status: 'UNKNOWN', lastSeen: null };
}

/**
 * Called by heartbeatSubscriber.js whenever a heartbeat message
 * arrives from the fanout exchange. Unconditionally sets the peer to
 * ALIVE regardless of its prior state - this is how recovery happens
 * automatically with no special-case code: the very next heartbeat
 * received after a DEAD marking flips it straight back to ALIVE.
 */
function recordHeartbeat(department, timestamp) {
  if (!peers[department]) {
    // Defensive - a heartbeat from an unrecognized department name is
    // logged by the caller, not silently added here, to avoid the
    // liveness table growing unbounded from malformed messages.
    return;
  }
  peers[department] = { status: 'ALIVE', lastSeen: timestamp };
}

/**
 * Marks any peer DEAD if its lastSeen is older than HEARTBEAT_TIMEOUT_MS.
 * Called on every read of the table (getLivenessTable) so a request
 * always reflects the freshest possible status.
 */
function checkTimeouts() {
  const now = Date.now();
  for (const dept of Object.keys(peers)) {
    const entry = peers[dept];
    if (entry.lastSeen) {
      const age = now - new Date(entry.lastSeen).getTime();
      if (age > HEARTBEAT_TIMEOUT_MS && entry.status !== 'DEAD') {
        entry.status = 'DEAD';
      }
    }
  }
}

function getLivenessTable() {
  checkTimeouts();
  return peers;
}

module.exports = { recordHeartbeat, getLivenessTable };
