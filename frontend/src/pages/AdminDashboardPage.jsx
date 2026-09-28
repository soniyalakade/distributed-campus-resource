import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAdminDepartmentResources } from '../api/endpoints';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAdminDepartmentResources()
      .then((resources) => {
        if (cancelled) return;
        const totals = resources.reduce(
          (acc, r) => ({
            totalResources: acc.totalResources + 1,
            availableUnits: acc.availableUnits + (r.availableQuantity || 0),
            reservedUnits: acc.reservedUnits + (r.reservedQuantity || 0),
            borrowedUnits: acc.borrowedUnits + (r.borrowedQuantity || 0),
          }),
          { totalResources: 0, availableUnits: 0, reservedUnits: 0, borrowedUnits: 0 }
        );
        setSummary(totals);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Unable to load department summary.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <div className="welcome-card">
        <h1>Welcome, {user?.name}</h1>
        <p className="muted">
          Department: <strong>{user?.department}</strong> — manage your department's resources and
          reservations.
        </p>
      </div>

      <h2 className="section-title">Quick actions</h2>
      <div className="card-grid">
        <Link className="dashboard-card dashboard-card-accent" to="/admin/resources/new">
          <span className="dashboard-card-icon">➕</span>
          <h3>Add Resource</h3>
          <p>Add a new resource to your department's catalog.</p>
        </Link>
        <Link className="dashboard-card" to="/admin/resources">
          <span className="dashboard-card-icon">📦</span>
          <h3>My Department Resources</h3>
          <p>View, edit, and delete resources you own.</p>
        </Link>
        <Link className="dashboard-card" to="/admin/reservations">
          <span className="dashboard-card-icon">📋</span>
          <h3>Department Reservations</h3>
          <p>See who has reserved your department's resources.</p>
        </Link>
        <Link className="dashboard-card" to="/admin/resources/all">
          <span className="dashboard-card-icon">🌐</span>
          <h3>All Campus Resources</h3>
          <p>Browse resources across CS, IT, and ENTC (view only).</p>
        </Link>
      </div>

      <h2 className="section-title">Department summary</h2>
      {loading && <p className="muted">Loading summary…</p>}
      {error && <div className="error-banner">{error}</div>}
      {summary && (
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-value">{summary.totalResources}</span>
            <span className="stat-label">Total resources</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.availableUnits}</span>
            <span className="stat-label">Available units</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.reservedUnits}</span>
            <span className="stat-label">Reserved units</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.borrowedUnits}</span>
            <span className="stat-label">Borrowed units</span>
          </div>
        </div>
      )}
    </div>
  );
}
