import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getNodesHealth } from '../api/endpoints';
import StatusBadge from '../components/StatusBadge';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getNodesHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div className="page">
      <div className="welcome-card">
        <h1>Welcome, {user?.name}</h1>
        <p className="muted">Find and reserve campus resources across departments.</p>
      </div>

      <h2 className="section-title">Quick actions</h2>
      <div className="card-grid">
        <Link className="dashboard-card dashboard-card-accent" to="/search">
          <span className="dashboard-card-icon">🔍</span>
          <h3>Search Resources</h3>
          <p>Search across CS, IT, and ENTC departments simultaneously.</p>
        </Link>
        <Link className="dashboard-card" to="/reservations">
          <span className="dashboard-card-icon">📋</span>
          <h3>My Reservations</h3>
          <p>View and manage your active reservations.</p>
        </Link>
        <Link className="dashboard-card" to="/borrowed">
          <span className="dashboard-card-icon">📦</span>
          <h3>Borrow / Return</h3>
          <p>Borrow a reserved item, or return one you're holding.</p>
        </Link>
      </div>

      <h2 className="section-title">System status</h2>
      <div className="stat-grid">
        {['CS', 'IT', 'ENTC'].map((dept) => {
          const entry = health?.find((h) => h.department === dept || h.nodeId === dept);
          return (
            <div className="stat-card stat-card-status" key={dept}>
              <span className="stat-label">{dept} Node</span>
              <StatusBadge status={entry?.status} />
            </div>
          );
        })}
      </div>

      <h2 className="section-title">More</h2>
      <div className="card-grid">
        <Link className="dashboard-card" to="/nodes">
          <span className="dashboard-card-icon">🖥️</span>
          <h3>Node Monitor</h3>
          <p>Live health and heartbeat status of every department node.</p>
        </Link>
        <Link className="dashboard-card" to="/visualization">
          <span className="dashboard-card-icon">🕸️</span>
          <h3>System Visualization</h3>
          <p>See how the distributed system's parts communicate.</p>
        </Link>
        <Link className="dashboard-card" to="/demo">
          <span className="dashboard-card-icon">🧪</span>
          <h3>Demo Panel</h3>
          <p>Run live demonstrations of the distributed-systems features.</p>
        </Link>
      </div>
    </div>
  );
}
