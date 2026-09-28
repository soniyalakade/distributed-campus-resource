import { useEffect, useState } from 'react';
import { getHeartbeat, getNodesHealth } from '../api/endpoints';
import { useLiveEvents } from '../hooks/useLiveEvents';
import StatusBadge from '../components/StatusBadge';

const POLL_INTERVAL_MS = 5000;

export default function VisualizationPage() {
  const [heartbeat, setHeartbeat] = useState(null);
  const [health, setHealth] = useState([]);
  const { events, connected } = useLiveEvents(10);

  useEffect(() => {
    async function refresh() {
      try {
        const [heartbeatData, healthData] = await Promise.all([getHeartbeat(), getNodesHealth()]);
        setHeartbeat(heartbeatData);
        setHealth(healthData);
      } catch {
        // Visualization degrades gracefully - node boxes just show UNKNOWN.
      }
    }
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const departments = ['CS', 'IT', 'ENTC'];

  return (
    <div className="page">
      <h1>Distributed System Visualization</h1>
      <p className="muted">
        This diagram reflects real, live system state - health from REST polling, liveness from RabbitMQ
        heartbeat, and events from the WebSocket relay. No leader/election data is shown because Bully
        election is a Phase 6 feature not yet implemented.
      </p>

      <div className="viz-diagram">
        <div className="viz-node viz-browser">Browser (you)</div>
        <div className="viz-arrow">REST + WebSocket</div>
        <div className="viz-node viz-gateway">API Gateway</div>
        <div className="viz-arrow">REST / gRPC (fan-out)</div>
        <div className="viz-dept-row">
          {departments.map((dept) => {
            const healthEntry = health.find((h) => h.department === dept);
            const peerEntry = heartbeat?.peers?.[dept];
            return (
              <div key={dept} className="viz-node viz-dept">
                <strong>{dept}</strong>
                <div>Health: <StatusBadge status={healthEntry?.status} /></div>
                <div>Heartbeat: <StatusBadge status={peerEntry?.status} /></div>
              </div>
            );
          })}
        </div>
        <div className="viz-arrow">P2P (direct HTTP between departments) + RabbitMQ</div>
      </div>

      <h3>Live Event Feed (WebSocket: {connected ? 'connected' : 'disconnected'})</h3>
      <ul className="event-feed">
        {events.length === 0 && <li className="muted">No events yet - try reserving or adding a resource.</li>}
        {events.map((e, i) => (
          <li key={i}>
            <strong>{e.eventType}</strong> - {e.payload?.department} - {e.timestamp}
          </li>
        ))}
      </ul>
    </div>
  );
}
