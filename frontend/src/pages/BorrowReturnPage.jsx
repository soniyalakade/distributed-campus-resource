import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyReservations, getMyBorrowedResources, borrowResource, returnResource } from '../api/endpoints';

/**
 * Both "Approved Reservations" and "Active Borrowed Resources" are now
 * sourced entirely from the backend on every load:
 *   - GET /api/reservations/my  (existing)
 *   - GET /api/borrow/my        (new - persistent, backed by each
 *     department's own BorrowRecord collection)
 *
 * There is no sessionStorage/localStorage involved anywhere in this
 * page anymore. A borrowed resource stays visible after a page
 * refresh, navigating away and back, or logging out and back in,
 * because it is real data read fresh from MongoDB every time this
 * page loads - not because anything is cached in the browser.
 */
export default function BorrowReturnPage() {
  const [reservations, setReservations] = useState(null);
  const [borrowed, setBorrowed] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [borrowingId, setBorrowingId] = useState(null);
  const [returningId, setReturningId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      const [reservationsData, borrowedData] = await Promise.all([
        getMyReservations(),
        getMyBorrowedResources(),
      ]);
      setReservations(reservationsData);
      setBorrowed(borrowedData);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Unable to load your reservations and borrowed resources.');
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const borrowedResourceIds = new Set((borrowed || []).map((b) => b.resourceId));
  const approvedReservations = (reservations || []).filter(
    (r) => r.status === 'APPROVED' && !borrowedResourceIds.has(r.resourceId)
  );

  async function handleBorrow(reservation) {
    setActionError(null);
    setBorrowingId(reservation.resourceId);
    try {
      // resourceId and department come directly from the reservation -
      // the student never types or selects either.
      await borrowResource(reservation.resourceId, reservation.department);
      setSuccessMessage(`Borrowed "${reservation.resourceName}" successfully.`);
      await loadAll(); // refresh both lists from the backend - no local state assembly
    } catch (err) {
      setActionError(err.response?.data?.error || `Could not borrow "${reservation.resourceName}". Please try again.`);
    } finally {
      setBorrowingId(null);
    }
  }

  async function handleReturn(record) {
    setActionError(null);
    setReturningId(record.resourceId);
    try {
      await returnResource(record.resourceId, record.department, 'GOOD');
      setSuccessMessage(`Returned "${record.resourceName}" successfully.`);
      await loadAll(); // refresh both lists from the backend
    } catch (err) {
      setActionError(err.response?.data?.error || `Could not return "${record.resourceName}". Please try again.`);
    } finally {
      setReturningId(null);
    }
  }

  const stillLoading = reservations === null && borrowed === null && !loadError;

  return (
    <div className="page">
      <h1>Borrow Resources</h1>
      <p className="muted">Borrow directly from your approved reservations — no resource ID or department to enter.</p>

      {actionError && <div className="error-banner">{actionError}</div>}
      {successMessage && <div className="success-banner">{successMessage}</div>}
      {loadError && <div className="error-banner">{loadError}</div>}

      <h2 className="section-title">Approved Reservations</h2>

      {stillLoading && <p className="muted">Loading your reservations…</p>}

      {reservations !== null && approvedReservations.length === 0 && !loadError && (
        <div className="empty-state">
          <p>No approved reservations ready to borrow.</p>
          <Link className="btn btn-primary" to="/search">Search available campus resources</Link>
        </div>
      )}

      {approvedReservations.length > 0 && (
        <div className="card-grid">
          {approvedReservations.map((r) => (
            <div className="dashboard-card" key={r.reservationId}>
              <h3>{r.resourceName || 'Unknown resource'}</h3>
              <p className="cell-secondary muted">{r.resourceId}</p>
              <div className="cell-actions" style={{ marginBottom: 10 }}>
                <span className="pill pill-blue">{r.department}</span>
                <span className="pill pill-green">{r.status}</span>
              </div>
              <button
                className="btn btn-primary"
                disabled={borrowingId === r.resourceId}
                onClick={() => handleBorrow(r)}
              >
                {borrowingId === r.resourceId ? 'Borrowing…' : 'Borrow Resource'}
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">Active Borrowed Resources</h2>

      {stillLoading && <p className="muted">Loading your borrowed resources…</p>}

      {borrowed !== null && borrowed.length === 0 && !loadError && (
        <div className="empty-state">
          <p>You have no active borrowed resources.</p>
        </div>
      )}

      {borrowed && borrowed.length > 0 && (
        <div className="card-list">
          {borrowed.map((item) => (
            <div className="reservation-card" key={item.recordId}>
              <div className="reservation-card-main">
                <h3>{item.resourceName || 'Unknown resource'}</h3>
                <p className="muted">Department: {item.department}</p>
                <p className="muted small">
                  Borrowed: {item.borrowedAt ? new Date(item.borrowedAt).toLocaleString() : '—'}
                </p>
                <p className="muted small">
                  Due: {item.dueAt ? new Date(item.dueAt).toLocaleString() : '—'}
                </p>
                <p className="muted small">Condition: {item.condition || '—'}</p>
              </div>
              <div className="reservation-card-side">
                <button
                  className="btn btn-secondary"
                  disabled={returningId === item.resourceId}
                  onClick={() => handleReturn(item)}
                >
                  {returningId === item.resourceId ? 'Returning…' : 'Return'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
