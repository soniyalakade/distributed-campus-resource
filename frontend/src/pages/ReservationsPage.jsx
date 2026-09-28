import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyReservations, cancelReservation } from '../api/endpoints';

/**
 * Uses GET /api/reservations/my (added for Phase 4), which aggregates
 * this student's reservations across CS/IT/ENTC and enriches each with
 * resourceName - no more resourceId-only display and no more
 * session-only tracking.
 */
export default function ReservationsPage() {
  const [reservations, setReservations] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(() => {
    setError(null);
    getMyReservations()
      .then(setReservations)
      .catch((err) => setError(err.response?.data?.error || 'Unable to load reservations. Please try again.'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel(reservation) {
    setActionError(null);
    setCancellingId(reservation.reservationId);
    try {
      await cancelReservation(reservation.reservationId, reservation.department);
      load();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Reservation could not be cancelled.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="page">
      <h1>My Reservations</h1>

      {error && <div className="error-banner">{error}</div>}
      {actionError && <div className="error-banner">{actionError}</div>}
      {reservations === null && !error && <p className="muted">Loading reservations…</p>}

      {reservations && reservations.length === 0 && (
        <div className="empty-state">
          <p>You have not made any reservations yet.</p>
          <Link className="btn btn-primary" to="/search">Search available campus resources</Link>
        </div>
      )}

      {reservations && reservations.length > 0 && (
        <div className="card-list">
          {reservations.map((r) => (
            <div className="reservation-card" key={r.reservationId}>
              <div className="reservation-card-main">
                <h3>{r.resourceName || 'Unknown resource'}</h3>
                <p className="muted">Department: {r.department}</p>
                <p className="muted small">Reserved on {new Date(r.createdAt).toLocaleString()}</p>
                <p className="muted small">Reservation ID: {r.reservationId}</p>
              </div>
              <div className="reservation-card-side">
                <span className={`pill ${r.status === 'CANCELLED' ? 'pill-gray' : r.status === 'REJECTED' ? 'pill-red' : 'pill-blue'}`}>
                  {r.status}
                </span>
                {['PENDING', 'APPROVED'].includes(r.status) && (
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={cancellingId === r.reservationId}
                    onClick={() => handleCancel(r)}
                  >
                    {cancellingId === r.reservationId ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
