import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * The owner portal used to live under `/dashboard`, which read as
 * `dashboard.lightor.app/dashboard/...` (LT-087). It now sits at the root.
 *
 * Anything still pointing at the old prefix — a bookmark, an old email link,
 * the Meta App Review screencast — lands on the matching root path rather
 * than a bare redirect home, so a deep link keeps its destination.
 */
const LegacyDashboardRedirect: React.FC = () => {
  const { pathname, search, hash } = useLocation();
  const target = pathname.replace(/^\/dashboard/, '') || '/';
  return <Navigate to={`${target}${search}${hash}`} replace />;
};

export default LegacyDashboardRedirect;
