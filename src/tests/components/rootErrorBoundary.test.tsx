import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RootErrorBoundary from '../../components/ui/RootErrorBoundary';
import { reportClientError } from '../../services/errorReporting';
import { stubLocation } from '../helpers/location';

vi.mock('../../services/errorReporting', () => ({
  reportClientError: vi.fn().mockResolvedValue(true),
}));

const Thrower = (): never => {
  throw new TypeError('provider exploded');
};

/**
 * The outermost boundary (LT-170): catches what App's boundary cannot (a
 * provider, the router), reports it, and gives the owner a way out instead
 * of a white page — with nothing but React, so it works when everything
 * else is broken.
 */
describe('RootErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(reportClientError).mockClear();
    document.documentElement.lang = '';
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders its children when nothing throws', () => {
    render(
      <RootErrorBoundary>
        <p>fine</p>
      </RootErrorBoundary>
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('shows a fallback with a reload button and reports the crash', () => {
    stubLocation('https://dashboard.lightor.app/appointments');
    render(
      <RootErrorBoundary>
        <Thrower />
      </RootErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    expect(alert).toHaveAttribute('dir', 'ltr');

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(window.location.reload).toHaveBeenCalledTimes(1);

    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(reportClientError).mock.calls[0][0]).toMatchObject({
      error: 'TypeError: provider exploded',
      kind: 'boundary',
    });
  });

  it('speaks the page language, right-to-left where it should', () => {
    document.documentElement.lang = 'he';
    render(
      <RootErrorBoundary>
        <Thrower />
      </RootErrorBoundary>
    );
    expect(screen.getByRole('alert')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'טעינה מחדש' })).toBeInTheDocument();
  });
});
