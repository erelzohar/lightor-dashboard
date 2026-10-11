import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * LT-249: `/ai` became the site editor's `/design`. Old links and the
 * floating assistant's message (carried in the location state) still arrive.
 */
const AiToDesignRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to="/design" replace state={location.state} />;
};

export default AiToDesignRedirect;
