import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAllCampusResources } from '../api/endpoints';
import StockStatusPill from '../components/StockStatusPill';

export default function AllCampusResourcesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAllCampusResources()
      .then(setGroups)
      .catch((err) => setError(err.response?.data?.error || 'Unable to load campus resources. Please try again.'));
  }, []);

  return (
    <div className="page">
      <h1>All Campus Resources</h1>
      <p className="muted">
        View-only across every department. You can only edit or delete resources belonging to your own
        department (<strong>{user?.department}</strong>) — this is enforced by the Gateway and department
        service, not just hidden in this UI.
      </p>

      {error && <div className="error-banner">{error}</div>}
      {!groups && !error && <p className="muted">Loading resources…</p>}

      {groups && groups.map((group) => (
        <div key={group.department} className="dept-section">
          <h2 className="section-title">{group.department}</h2>
          {group.error && <div className="error-banner">This department's node did not respond.</div>}
          {!group.error && group.resources.length === 0 && (
            <div className="empty-state"><p>No resources in this department.</p></div>
          )}
          {!group.error && group.resources.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Category</th>
                    <th>Available</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.resources.map((r) => {
                    const editable = group.department === user?.department;
                    return (
                      <tr key={r.resourceId}>
                        <td className="cell-primary">{r.name}</td>
                        <td>{r.category}</td>
                        <td>{r.availableQuantity}</td>
                        <td><StockStatusPill resource={r} /></td>
                        <td className="cell-actions">
                          {editable ? (
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/resources/${r.resourceId}/edit`)}>
                              Edit
                            </button>
                          ) : (
                            <span className="muted small">View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
