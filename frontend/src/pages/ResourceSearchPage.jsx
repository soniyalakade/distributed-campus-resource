import { useState } from 'react';
import { Link } from 'react-router-dom';
import { searchResources, createReservation } from '../api/endpoints';

export default function ResourceSearchPage() {
  const [name, setName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reserveStatus, setReserveStatus] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    setError(null);
    setReserveStatus(null);
    setLoading(true);
    try {
      const data = await searchResources(name);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleReserve(department, resourceId) {
    setReserveStatus(null);
    try {
      const reservation = await createReservation(department, resourceId);
      setReserveStatus({ ok: true, message: `Reserved (reservationId: ${reservation.reservationId})` });
    } catch (err) {
      setReserveStatus({ ok: false, message: err.response?.data?.error || 'Reservation failed' });
    }
  }

  return (
    <div className="page">
      <h1>Resource Search</h1>
      <p className="muted">
        This search is genuinely distributed: the Gateway queries CS, IT, and ENTC concurrently and aggregates
        the results below - it does not read from a single shared database.
      </p>

      <form className="search-form" onSubmit={handleSearch}>
        <input
          placeholder="e.g. Arduino Uno"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}
      {reserveStatus && (
        <div className={reserveStatus.ok ? 'success-banner' : 'error-banner'}>{reserveStatus.message}</div>
      )}

      {result && (
        <div className="search-results">
          <h3>
            Total available across all departments: <strong>{result.totalAvailable}</strong>
          </h3>
          {result.nodesUnreachable?.length > 0 && (
            <div className="error-banner">Unreachable nodes: {result.nodesUnreachable.join(', ')}</div>
          )}
          <div className="dept-columns">
            {result.results.map((dept) => (
              <div key={dept.department} className="dept-column">
                <h4>{dept.department}</h4>
                <p>Available: {dept.available ?? 'N/A'}</p>
                {dept.error && <p className="error-text">{dept.error}</p>}
                <ul>
                  {(dept.matches || []).map((m) => (
                    <li key={m.resourceId || m.name}>
                      <Link to={m.resourceId ? `/resources/${m.resourceId}` : '#'}>{m.name}</Link>
                      {' '}- qty {m.availableQuantity}
                      {m.resourceId && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleReserve(dept.department, m.resourceId)}>Reserve</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
