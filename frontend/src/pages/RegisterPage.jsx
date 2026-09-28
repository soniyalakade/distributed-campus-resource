import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STUDENT', department: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = { name: form.name, email: form.email, password: form.password, role: form.role };
      if (form.role === 'DEPARTMENT_ADMIN') {
        payload.department = form.department;
      }
      await register(payload);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Register</h2>
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">Account created - redirecting to login...</div>}
        <label>
          Name
          <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(e) => update('role', e.target.value)}>
            <option value="STUDENT">Student</option>
            <option value="DEPARTMENT_ADMIN">Department Admin</option>
          </select>
        </label>
        {form.role === 'DEPARTMENT_ADMIN' && (
          <label>
            Department
            <select value={form.department} onChange={(e) => update('department', e.target.value)} required>
              <option value="">Select...</option>
              <option value="CS">CS</option>
              <option value="IT">IT</option>
              <option value="ENTC">ENTC</option>
            </select>
          </label>
        )}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Register'}
        </button>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
