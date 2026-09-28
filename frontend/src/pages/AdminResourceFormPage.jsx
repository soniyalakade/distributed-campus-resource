import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { createAdminResource, updateAdminResource, getAdminDepartmentResources } from '../api/endpoints';

const EMPTY_FORM = {
  name: '',
  category: '',
  description: '',
  laboratory: '',
  totalQuantity: 1,
  condition: 'GOOD',
  imageUrl: '',
  manualUrl: '',
  tutorialVideoUrl: '',
};

export default function AdminResourceFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    // No single-resource admin GET exists, so we load the department
    // list (an endpoint we already have) and find this one - avoids
    // adding a redundant endpoint for a value we can already fetch.
    getAdminDepartmentResources()
      .then((resources) => {
        const existing = resources.find((r) => r.resourceId === id);
        if (!existing) {
          setError('Resource not found in your department.');
          return;
        }
        setForm({
          name: existing.name,
          category: existing.category,
          description: existing.description || '',
          laboratory: existing.laboratory || '',
          totalQuantity: existing.totalQuantity,
          condition: existing.condition || 'GOOD',
          imageUrl: existing.imageUrl || '',
          manualUrl: existing.manualUrl || '',
          tutorialVideoUrl: existing.tutorialVideoUrl || '',
        });
      })
      .catch(() => setError('Unable to load this resource. Please try again.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = { ...form, totalQuantity: Number(form.totalQuantity) };
      if (isEdit) {
        await updateAdminResource(id, payload);
      } else {
        await createAdminResource(payload);
      }
      setSuccess(true);
      setTimeout(() => navigate('/admin/resources'), 900);
    } catch (err) {
      setError(err.response?.data?.error || `Resource could not be ${isEdit ? 'updated' : 'created'}.`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page"><p className="muted">Loading resource…</p></div>;

  return (
    <div className="page page-narrow">
      <h1>{isEdit ? 'Edit Resource' : 'Add Resource'}</h1>
      <p className="muted">Department: <strong>{user?.department}</strong> (determined automatically from your account)</p>

      <form className="form-card" onSubmit={handleSubmit}>
        <label>
          Name <span className="required">*</span>
          <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </label>
        <label>
          Category <span className="required">*</span>
          <input value={form.category} onChange={(e) => update('category', e.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} />
        </label>
        <label>
          Laboratory
          <input value={form.laboratory} onChange={(e) => update('laboratory', e.target.value)} />
        </label>
        <label>
          Total Quantity <span className="required">*</span>
          <input
            type="number"
            min={0}
            value={form.totalQuantity}
            onChange={(e) => update('totalQuantity', e.target.value)}
            required
          />
          {isEdit && (
            <span className="field-hint">
              Changing this does not automatically adjust availableQuantity/reservedQuantity server-side.
            </span>
          )}
        </label>
        <label>
          Condition
          <select value={form.condition} onChange={(e) => update('condition', e.target.value)}>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
            <option value="DAMAGED">Damaged</option>
          </select>
        </label>
        <label>
          Image URL
          <input value={form.imageUrl} onChange={(e) => update('imageUrl', e.target.value)} />
        </label>
        <label>
          Manual URL
          <input value={form.manualUrl} onChange={(e) => update('manualUrl', e.target.value)} />
        </label>
        <label>
          Tutorial Video URL
          <input value={form.tutorialVideoUrl} onChange={(e) => update('tutorialVideoUrl', e.target.value)} />
        </label>

        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">Resource {isEdit ? 'updated' : 'created'} successfully.</div>}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/resources')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Resource'}
          </button>
        </div>
      </form>
    </div>
  );
}
