import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ResourceSearchPage from './pages/ResourceSearchPage';
import ResourceDetailsPage from './pages/ResourceDetailsPage';
import ReservationsPage from './pages/ReservationsPage';
import BorrowReturnPage from './pages/BorrowReturnPage';
import NodeMonitorPage from './pages/NodeMonitorPage';
import VisualizationPage from './pages/VisualizationPage';
import DemoPanelPage from './pages/DemoPanelPage';
import AdminResourcesPage from './pages/AdminResourcesPage';
import AdminResourceFormPage from './pages/AdminResourceFormPage';
import AllCampusResourcesPage from './pages/AllCampusResourcesPage';
import AdminReservationsPage from './pages/AdminReservationsPage';

/**
 * Sends an authenticated user to the dashboard that matches their role.
 * Used for "/" and any unmatched path - never hardcodes the student
 * dashboard as the universal fallback.
 */
function RoleHome() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={user?.role === 'DEPARTMENT_ADMIN' ? '/admin/dashboard' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* STUDENT-only routes */}
          <Route path="/dashboard" element={<ProtectedRoute roles={['STUDENT']}><StudentDashboardPage /></ProtectedRoute>} />
          <Route path="/borrowed" element={<ProtectedRoute roles={['STUDENT']}><BorrowReturnPage /></ProtectedRoute>} />
          <Route path="/reservations" element={<ProtectedRoute roles={['STUDENT']}><ReservationsPage /></ProtectedRoute>} />

          {/* DEPARTMENT_ADMIN-only routes */}
          <Route path="/admin/dashboard" element={<ProtectedRoute roles={['DEPARTMENT_ADMIN']}><AdminDashboardPage /></ProtectedRoute>} />
          <Route path="/admin/resources/all" element={<ProtectedRoute roles={['DEPARTMENT_ADMIN']}><AllCampusResourcesPage /></ProtectedRoute>} />
          <Route path="/admin/resources/new" element={<ProtectedRoute roles={['DEPARTMENT_ADMIN']}><AdminResourceFormPage /></ProtectedRoute>} />
          <Route path="/admin/resources/:id/edit" element={<ProtectedRoute roles={['DEPARTMENT_ADMIN']}><AdminResourceFormPage /></ProtectedRoute>} />
          <Route path="/admin/resources" element={<ProtectedRoute roles={['DEPARTMENT_ADMIN']}><AdminResourcesPage /></ProtectedRoute>} />
          <Route path="/admin/reservations" element={<ProtectedRoute roles={['DEPARTMENT_ADMIN']}><AdminReservationsPage /></ProtectedRoute>} />

          {/* Shared routes - any authenticated role */}
          <Route path="/search" element={<ProtectedRoute><ResourceSearchPage /></ProtectedRoute>} />
          <Route path="/resources/:id" element={<ProtectedRoute><ResourceDetailsPage /></ProtectedRoute>} />
          <Route path="/nodes" element={<ProtectedRoute><NodeMonitorPage /></ProtectedRoute>} />
          <Route path="/visualization" element={<ProtectedRoute><VisualizationPage /></ProtectedRoute>} />
          <Route path="/demo" element={<ProtectedRoute><DemoPanelPage /></ProtectedRoute>} />

          <Route path="/" element={<RoleHome />} />
          <Route path="*" element={<RoleHome />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
