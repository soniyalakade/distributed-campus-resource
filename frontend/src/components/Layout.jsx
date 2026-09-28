import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const STUDENT_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/search', label: 'Search Resources' },
  { to: '/reservations', label: 'My Reservations' },
  { to: '/borrowed', label: 'Borrow / Return' },
  { to: '/nodes', label: 'Node Monitor' },
  { to: '/visualization', label: 'System View' },
  { to: '/demo', label: 'Demo Panel' },
];

const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/resources', label: 'My Department Resources' },
  { to: '/admin/resources/new', label: 'Add Resource' },
  { to: '/admin/reservations', label: 'Department Reservations' },
  { to: '/admin/resources/all', label: 'All Campus Resources' },
  { to: '/nodes', label: 'Node Monitor' },
  { to: '/visualization', label: 'System View' },
  { to: '/demo', label: 'Demo Panel' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = user?.role === 'DEPARTMENT_ADMIN' ? ADMIN_NAV : STUDENT_NAV;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-mark">CR</span>
          <span className="app-brand-text">Campus Resource Sharing</span>
        </div>
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="app-user">
          {user && (
            <div className="app-user-info">
              <span className="app-user-name">{user.name}</span>
              <span className="pill pill-role">{user.role === 'DEPARTMENT_ADMIN' ? `Admin · ${user.department}` : 'Student'}</span>
            </div>
          )}
          <button className="btn btn-ghost" onClick={handleLogout}>Log out</button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
