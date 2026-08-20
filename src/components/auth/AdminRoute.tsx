import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard for the operator admin panel (LT-058).
 *
 * UX only: `auth.user.role` comes from a client-readable /auth/me response,
 * so this guard exists to keep non-admins from seeing a broken shell — the
 * real boundary is `authorize('admin')` on every /api/admin route, which the
 * server re-checks against the database on each request.
 *
 * No verify-email gate here: the operator is the person who ships the
 * product, not a fresh signup mid-grace-window.
 */
const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { auth } = useAuth();

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-bg">
        <Loader size={40} className="text-primary animate-spin" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (auth.user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
