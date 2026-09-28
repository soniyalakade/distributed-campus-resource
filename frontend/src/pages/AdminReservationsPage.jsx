import { useEffect, useState } from 'react';
import { getAdminReservations } from '../api/endpoints';

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminReservations()
      .then(setReservations)
      .catch((err) => setError(err.response?.data?.error || 'Unable to load reservations. Please try again.'));
  }, []);

  return (
    <div className="page">
      <h1>Department Reservations</h1>

      {error && <div className="error-banner">{error}</div>}
      {reservations === null && !error && <p className="muted">Loading reservations…</p>}

      {reservations && reservations.length === 0 && (
        <div className="empty-state">
          <p>No reservations found for your department yet.</p>
        </div>
      )}

      {reservations && reservations.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Student</th>
                <th>Status</th>
                <th>Reserved On</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.reservationId}>
                  <td>
                    <div className="cell-primary">{r.resourceName || 'Unknown resource'}</div>
                    <div className="cell-secondary muted">{r.resourceId}</div>
                  </td>
                  <td className="cell-secondary">{r.studentId}</td>
                  <td><span className={`pill ${r.status === 'CANCELLED' ? 'pill-gray' : 'pill-blue'}`}>{r.status}</span></td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
