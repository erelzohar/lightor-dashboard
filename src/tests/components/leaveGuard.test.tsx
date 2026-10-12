import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LeaveGuardProvider, useLeaveGuard, useUnsavedChangesGuard } from '../../contexts/LeaveGuardContext';
import { LightyText } from '../../components/lighty/LightyChat';
import Sidebar from '../../components/layout/Sidebar';
import { fetchLeads } from '../../services/leadsApi';

const { t, logout } = vi.hoisted(() => ({ t: (key: string) => key, logout: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout, auth: { user: { _id: 'u1', name: 'Erel', role: 'user' }, isAuthenticated: true } }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', darkMode: false, toggleDarkMode: vi.fn() }),
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({ webConfig: { data: { businessName: 'Biz', conversion: 'book' } } }),
}));
vi.mock('../../services/leadsApi', () => ({ fetchLeads: vi.fn() }));

/** A page holding unsaved work while `dirty`, as the site editor does. */
const Editing: React.FC<{ dirty: boolean }> = ({ dirty }) => {
  useUnsavedChangesGuard(dirty);
  return <p>editor</p>;
};
/** A way out that is not a link: log-out, a tapped notification. */
const LeaveButton: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const { confirmLeave } = useLeaveGuard();
  return <button type="button" onClick={() => confirmLeave(onLeave)}>leave</button>;
};
const Where: React.FC = () => {
  const { pathname, search } = useLocation();
  return <span data-testid="where">{pathname + search}</span>;
};

const renderEditor = (dirty: boolean, onLeave = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={['/design']}>
      <LeaveGuardProvider>
        <Routes>
          <Route
            path="/design"
            element={
              <>
                <Editing dirty={dirty} />
                <LightyText text="See [the calendar](/appointments?date=2026-10-14) or [this page](/design)." />
                <LeaveButton onLeave={onLeave} />
              </>
            }
          />
          <Route path="/appointments" element={<p>appointments page</p>} />
        </Routes>
        <Where />
      </LeaveGuardProvider>
    </MemoryRouter>
  );
  return onLeave;
};
const dialogShown = () => screen.queryByText('common.unsavedLeaveTitle') !== null;

beforeEach(() => {
  logout.mockReset();
  vi.mocked(fetchLeads).mockResolvedValue({
    success: true,
    data: [],
    pagination: { total: 0, page: 1, limit: 1, pages: 0 },
    counts: { new: 0, contacted: 0, closed: 0 },
  });
});

/**
 * LT-267: the router is no data router, so leaving unsaved work is guarded by
 * the ways out themselves — they ask while a page holds unsaved work, and
 * stay out of the way otherwise.
 */
describe('the leave guard', () => {
  it("asks before a link in Lighty's answer leaves unsaved work", async () => {
    renderEditor(true);
    fireEvent.click(screen.getByText('the calendar'));
    expect(dialogShown()).toBe(true);
    expect(screen.getByTestId('where')).toHaveTextContent('/design');

    fireEvent.click(screen.getByText('common.leaveWithoutSaving'));
    expect(await screen.findByText('appointments page')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/appointments?date=2026-10-14');
  });

  it('lets a link to the page itself through without asking', () => {
    renderEditor(true);
    fireEvent.click(screen.getByText('this page'));
    expect(dialogShown()).toBe(false);
    expect(screen.getByText('editor')).toBeInTheDocument();
  });

  it('leaves a click for a new tab to the browser', () => {
    renderEditor(true);
    fireEvent.click(screen.getByText('the calendar'), { metaKey: true });
    expect(dialogShown()).toBe(false);
    expect(screen.getByTestId('where')).toHaveTextContent('/design');
  });

  it('asks before any other way out; staying runs nothing', async () => {
    const onLeave = renderEditor(true);
    fireEvent.click(screen.getByText('leave'));
    expect(dialogShown()).toBe(true);
    fireEvent.click(screen.getByText('common.stay'));
    await waitFor(() => expect(dialogShown()).toBe(false));
    expect(onLeave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('leave'));
    fireEvent.click(screen.getByText('common.leaveWithoutSaving'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('asks nothing when nothing is unsaved', async () => {
    const onLeave = renderEditor(false);
    fireEvent.click(screen.getByText('leave'));
    expect(onLeave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('the calendar'));
    expect(await screen.findByText('appointments page')).toBeInTheDocument();
    expect(dialogShown()).toBe(false);
  });

  it("guards the sidebar's links and its log-out", async () => {
    render(
      <MemoryRouter initialEntries={['/design']}>
        <LeaveGuardProvider>
          <Editing dirty />
          <Sidebar />
          <Where />
        </LeaveGuardProvider>
      </MemoryRouter>
    );
    fireEvent.click(within(screen.getByRole('group', { name: 'sidebar.manage' })).getByText('common.customers'));
    expect(dialogShown()).toBe(true);
    fireEvent.click(screen.getByText('common.stay'));
    await waitFor(() => expect(dialogShown()).toBe(false));
    expect(screen.getByTestId('where')).toHaveTextContent('/design');

    fireEvent.click(screen.getByText('common.logout'));
    expect(dialogShown()).toBe(true);
    expect(logout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('common.leaveWithoutSaving'));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
