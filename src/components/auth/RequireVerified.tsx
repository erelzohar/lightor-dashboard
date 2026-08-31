import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import VerifyEmailGate from './VerifyEmailGate';

interface RequireVerifiedProps {
  children: React.ReactNode;
}

/**
 * Hard email-verification gate for the AI builder / site editor (LT-099).
 *
 * ProtectedRoute grants unverified accounts a 48h grace window over the whole
 * dashboard, but the AI builder spends real money (Gemini) and edits the live
 * site, so it gets no grace: an unverified signed-in account is shown the
 * verify screen instead, regardless of how fresh the signup is. The matching
 * server-side gate lives on the /ai/* endpoints (requireVerifiedIfSignedIn),
 * so this is UX, not the security boundary.
 *
 * Rendered inside Layout's <Outlet>, so the sidebar/topbar stay put and the
 * user can navigate away or verify-and-retry without a reload.
 */
const RequireVerified: React.FC<RequireVerifiedProps> = ({ children }) => {
  const { auth } = useAuth();

  if (auth.user && !auth.user.isVerified) {
    return <VerifyEmailGate />;
  }

  return <>{children}</>;
};

export default RequireVerified;
