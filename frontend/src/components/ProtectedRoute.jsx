import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Layout from './Layout';

/**
 * `roles`, when provided, restricts this route to the listed JWT roles
 * (e.g. roles={['DEPARTMENT_ADMIN']}). This is a UX/navigation guard
 * only - typing a forbidden URL directly is what this stops; it is not
 * the security boundary. The real boundary is the Gateway/department
 * service rejecting the underlying API calls for the wrong role or
 * department, which happens independently of what routes exist here.
 */
export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    const fallback = user?.role === 'DEPARTMENT_ADMIN' ? '/admin/dashboard' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return <Layout>{children}</Layout>;
}
