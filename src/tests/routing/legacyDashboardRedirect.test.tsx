import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import LegacyDashboardRedirect from '../../components/routing/LegacyDashboardRedirect';

/**
 * LT-087 — the portal moved off the `/dashboard` prefix. Old links have to
 * keep working, and keep their destination: sending every stale bookmark to
 * the home page would quietly break the Meta App Review screencast, which
 * walks a reviewer to /dashboard/portfolio.
 */
const Where: React.FC<{ label: string }> = ({ label }) => {
  const { pathname, search, hash } = useLocation();
  return <div>{`${label}|${pathname}${search}${hash}`}</div>;
};

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/dashboard/*" element={<LegacyDashboardRedirect />} />
        <Route path="/" element={<Where label="home" />} />
        <Route path="/portfolio" element={<Where label="portfolio" />} />
        <Route path="/settings" element={<Where label="settings" />} />
        <Route path="/users/:id" element={<Where label="user-detail" />} />
      </Routes>
    </MemoryRouter>
  );

describe('LT-087 legacy /dashboard redirect', () => {
  it('keeps the destination of a deep link', () => {
    renderAt('/dashboard/portfolio');
    expect(screen.getByText('portfolio|/portfolio')).toBeInTheDocument();
  });

  it('sends the bare prefix to the root', () => {
    renderAt('/dashboard');
    expect(screen.getByText('home|/')).toBeInTheDocument();
  });

  it('sends a trailing slash to the root', () => {
    renderAt('/dashboard/');
    expect(screen.getByText('home|/')).toBeInTheDocument();
  });

  it('carries the query string and hash across', () => {
    renderAt('/dashboard/settings?tab=billing#logo');
    expect(screen.getByText('settings|/settings?tab=billing#logo')).toBeInTheDocument();
  });

  it('keeps nested path segments', () => {
    renderAt('/dashboard/users/abc123');
    expect(screen.getByText('user-detail|/users/abc123')).toBeInTheDocument();
  });
});
