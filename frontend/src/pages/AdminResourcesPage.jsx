import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminDepartmentResources, deleteAdminResource } from '../api/endpoints';
import StockStatusPill from '../components/StockStatusPill';
import ConfirmDialog from '../components/ConfirmDialog';

export default function AdminResourcesPage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState(null);
  const [error, setError] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    getAdminDepartmentResources()
      .then(setResources)
      .catch((err) => setError(err.response?.data?.error || 'Unable to load resources. Please try again.'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    setDeleteError(null);
    try {
      await deleteAdminResource(pendingDelete.resourceId);
      setPendingDelete(null);
      load();
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Resource could not be deleted.');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Department Resources</h1>
        <Link className="btn btn-primary" to="/admin/resources/new">➕ Add Resource</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {resources === null && !error && <p className="muted">Loading resources…</p>}

      {resources && resources.length === 0 && (
        <div className="empty-state">
          <p>No resources found in your department.</p>
          <Link className="btn btn-primary" to="/admin/resources/new">Add your first resource</Link>
        </div>
      )}

      {resources && resources.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Category</th>
                <th>Total</th>
                <th>Available</th>
                <th>Reserved</th>
                <th>Borrowed</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.resourceId}>
                  <td>
                    <div className="cell-primary">{r.name}</div>
                    <div className="cell-secondary">{r.laboratory || '—'}</div>
                  </td>
                  <td>{r.category}</td>
                  <td>{r.totalQuantity}</td>
                  <td>{r.availableQuantity}</td>
                  <td>{r.reservedQuantity}</td>
                  <td>{r.borrowedQuantity}</td>
                  <td><StockStatusPill resource={r} /></td>
                  <td className="cell-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/resources/${r.resourceId}/edit`)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setPendingDelete(r)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete Resource?"
          message={`Are you sure you want to delete "${pendingDelete.name}"? This action cannot be undone.`}
          confirmLabel="Delete Resource"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
      {deleteError && <div className="error-banner">{deleteError}</div>}
    </div>
  );
}
