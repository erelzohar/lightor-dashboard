import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from 'lucide-react';
import VerifyEmailGate from './VerifyEmailGate';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * How long an unverified email account keeps full access (LT-009).
 *
 * Immediately gating a fresh signup would slam a wall in front of the site
 * they just built with the AI wizard; never gating (the old dismissible
 * banner) meant "verify your email" was a suggestion. 48 hours preserves the
 * first-session experience and still guarantees an unverified account cannot
 * operate indefinitely. Social accounts arrive verified and never see this.
 */
const VERIFY_GRACE_MS = 48 * 60 * 60 * 1000;

const pastGrace = (createdAt: string | Date | undefined): boolean => {
  if (!createdAt) return true; // no timestamp — fail toward the gate
  return Date.now() - new Date(createdAt).getTime() > VERIFY_GRACE_MS;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
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

  if (auth.user && !auth.user.isVerified && pastGrace(auth.user.createdAt)) {
    return <VerifyEmailGate />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;