import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getResourceById, createReservation } from '../api/endpoints';

export default function ResourceDetailsPage() {
  const { id } = useParams();
  const [resource, setResource] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getResourceById(id)
      .then(setResource)
      .catch((err) => setError(err.response?.data?.error || 'Could not load resource'));
  }, [id]);

  async function handleReserve() {
    setStatus(null);
    try {
      const reservation = await createReservation(resource.department, resource.resourceId);
      setStatus({ ok: true, message: `Reserved (reservationId: ${reservation.reservationId})` });
    } catch (err) {
      setStatus({ ok: false, message: err.response?.data?.error || 'Reservation failed' });
    }
  }

  if (error) return <div className="page error-banner">{error}</div>;
  if (!resource) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <h1>{resource.name}</h1>
      <p>Department: {resource.department}</p>
      <p>Category: {resource.category}</p>
      <p>Laboratory: {resource.laboratory}</p>
      <p>Condition: {resource.condition}</p>
      <p>
        Total: {resource.totalQuantity} | Available: {resource.availableQuantity} | Reserved:{' '}
        {resource.reservedQuantity} | Borrowed: {resource.borrowedQuantity}
      </p>
      {status && <div className={status.ok ? 'success-banner' : 'error-banner'}>{status.message}</div>}
      <button className="btn btn-primary" onClick={handleReserve} disabled={resource.availableQuantity <= 0}>
        Reserve
      </button>
    </div>
  );
}
