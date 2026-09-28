import { useEffect, useState } from 'react';
import { getNodes, getNodesHealth, getHeartbeat } from '../api/endpoints';
import StatusBadge from '../components/StatusBadge';

const POLL_INTERVAL_MS = 5000;

/**
 * Priority and coordinator status are part of the Bully election
 * design (Phase 6), which is not implemented yet - this page shows
 * "Not yet implemented" for those fields rather than hardcoding fake
 * values, per the project's explicit rule against faking distributed
 * algorithm results.
 */
export default function NodeMonitorPage() {
  const [nodes, setNodes] = useState([]);
  const [health, setHealth] = useState([]);
  const [heartbeat, setHeartbeat] = useState(null);
  const [error, setError] = useState(null);

  async function refresh() {
    try {
      const [nodesData, healthData, heartbeatData] = await Promise.all([
        getNodes(),
        getNodesHealth(),
        getHeartbeat(),
      ]);
      setNodes(nodesData);
      setHealth(healthData);
      setHeartbeat(heartbeatData);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reach the Gateway');
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const departments = nodes.map((n) => n.department);

  return (
    <div className="page">
      <h1>Distributed Node Monitor</h1>
      {error && <div className="error-banner">{error}</div>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Department</th>
            <th>REST Address</th>
            <th>Health</th>
            <th>Heartbeat (RabbitMQ-derived)</th>
            <th>Last Seen</th>
            <th>Priority</th>
            <th>Coordinator</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((dept) => {
            const healthEntry = health.find((h) => h.department === dept || h.nodeId === dept);
            const peerEntry = heartbeat?.peers?.[dept];
            return (
              <tr key={dept}>
                <td>{dept}</td>
                <td>{nodes.find((n) => n.department === dept)?.internalBase}</td>
                <td>
                  <StatusBadge status={healthEntry?.status} />
                </td>
                <td>
                  <StatusBadge status={peerEntry?.status} />
                </td>
                <td>{peerEntry?.lastSeen ? new Date(peerEntry.lastSeen).toLocaleTimeString() : '-'}</td>
                <td className="muted">Not yet implemented (Phase 6)</td>
                <td className="muted">Not yet implemented (Phase 6)</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
